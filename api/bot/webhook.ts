/**
 * POST /api/bot/webhook
 * Обрабатывает сообщения юзера: /start, /help, текст, голос, нажатия inline-кнопок.
 */

import { json } from '../_shared'
import { sendBotMessage, editBotMessage, answerCallback, escapeHtml } from '../_bot'
import { setPendingReferral, addPendingTx, removePendingTx, type PendingTx } from '../_kv'
import { parseExpensePhrase } from '../_parser'

export const config = { runtime: 'edge' }

const BOT_WEBHOOK_SECRET = (globalThis as any).process?.env?.BOT_WEBHOOK_SECRET
  ?? (typeof process !== 'undefined' ? process.env?.BOT_WEBHOOK_SECRET : undefined)

const APP_URL = 'https://t.me/savemoney_gs_bot/finance'

interface TgVoice {
  file_id: string
  duration: number
  transcription?: string
}

interface TgUpdate {
  message?: {
    message_id: number
    from?: { id: number; first_name?: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    voice?: TgVoice
  }
  callback_query?: {
    id: string
    from: { id: number; first_name?: string }
    message?: { message_id: number; chat: { id: number } }
    data?: string
  }
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Еда': '🍔', 'Транспорт': '🚗', 'Дом': '🏠', 'Развлечения': '🎮',
  'Одежда': '👕', 'Здоровье': '💊', 'Поездки': '✈️', 'Связь': '📱',
  'Подарки': '🎁', 'Спорт': '💪', 'Образование': '📚', 'Подписки': '🔁',
  'Зарплата': '💰', 'Другое': '📌',
}

const CURRENCY_SIGN: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', KZT: '₸', BYN: 'Br', UAH: '₴',
  GBP: '£', CNY: '¥', JPY: '¥', TRY: '₺',
}

const dateLabel = (daysAgo: number): string => {
  if (daysAgo === 0) return 'сегодня'
  if (daysAgo === 1) return 'вчера'
  return `${daysAgo} дн. назад`
}

const formatTxCard = (tx: PendingTx, daysAgo: number): string => {
  const sign = tx.type === 'expense' ? '−' : '+'
  const emoji = CATEGORY_EMOJI[tx.categoryGuess] || '📌'
  const cur = CURRENCY_SIGN[tx.currency] || tx.currency
  let text = `${emoji} <b>${escapeHtml(tx.categoryGuess)}</b>\n`
  text += `${sign}${tx.amount.toLocaleString('ru-RU')} ${cur} · ${dateLabel(daysAgo)}`
  if (tx.merchant) text += ` · ${escapeHtml(tx.merchant)}`
  if (tx.comment) text += `\n<i>${escapeHtml(tx.comment)}</i>`
  text += `\n\nДобавить в Сохранёнки?`
  return text
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (BOT_WEBHOOK_SECRET) {
    const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (got !== BOT_WEBHOOK_SECRET) return json({ error: 'forbidden' }, 403)
  }

  let update: TgUpdate
  try {
    update = await req.json()
  } catch {
    return json({ ok: true })
  }

  if (update.callback_query) {
    return handleCallback(update.callback_query)
  }

  const msg = update.message
  if (!msg?.from) return json({ ok: true })

  const userId = String(msg.from.id)
  const firstName = msg.from.first_name ?? 'друг'

  if (msg.voice) {
    const transcript = msg.voice.transcription
    if (!transcript) {
      await sendBotMessage(userId, {
        text:
          '🎤 Голосовые пока распознаём только у Telegram Premium.\n\n'
          + 'Пришли текстом, например:\n<code>такси 500</code>',
      })
      return json({ ok: true })
    }
    await handlePhrase(userId, transcript, 'voice')
    return json({ ok: true })
  }

  if (!msg.text) return json({ ok: true })
  const text = msg.text.trim()

  if (text.startsWith('/start')) {
    const param = text.slice('/start'.length).trim()
    if (param.startsWith('ref_')) {
      const inviterId = param.slice(4)
      if (/^\d+$/.test(inviterId) && inviterId !== userId) {
        try { await setPendingReferral(userId, inviterId) } catch {}
      }
    }
    const greet =
      `Привет, <b>${escapeHtml(firstName)}</b>! 👋\n\n`
      + `<b>Сохранёнки</b> — учёт финансов прямо в Telegram.\n\n`
      + `💬 Пиши в этот чат: <i>«такси 500»</i>\n`
      + `🎤 Или голосом (Telegram Premium)\n`
      + `📸 В приложении — скан чеков, статистика, цели\n\n`
      + `Жми кнопку 👇`
    await sendBotMessage(userId, { text: greet, withOpenButton: true })
    return json({ ok: true })
  }

  if (text === '/help') {
    await sendBotMessage(userId, {
      text:
        `<b>Как пользоваться</b>\n\n`
        + `Пиши фразы, я распознаю:\n`
        + `• <code>такси 500</code>\n`
        + `• <code>пятёрочка 1500</code>\n`
        + `• <code>зарплата 80к</code>\n`
        + `• <code>вчера купил шоколадку 120</code>\n`
        + `• <code>20 долларов за игру</code>\n\n`
        + `После распознавания я покажу карточку — жми «Добавить», операция попадёт в приложение.`,
    })
    return json({ ok: true })
  }

  await handlePhrase(userId, text, 'text')
  return json({ ok: true })
}

const handlePhrase = async (userId: string, rawText: string, source: 'text' | 'voice') => {
  if (rawText.length > 200) {
    await sendBotMessage(userId, { text: '⚠ Слишком длинное сообщение. Коротко: «такси 500».' })
    return
  }

  let parsed
  try {
    parsed = await parseExpensePhrase(rawText)
  } catch (e) {
    console.error('parse error:', (e as Error).message)
    await sendBotMessage(userId, { text: '❌ Не получилось распознать. Попробуй ещё раз или открой приложение.' })
    return
  }

  if (!parsed) {
    await sendBotMessage(userId, {
      text:
        `🤔 Не понял. Напиши так:\n`
        + `<code>такси 500</code>\n`
        + `<code>пятёрочка 1500</code>`,
    })
    return
  }

  const date = new Date()
  date.setDate(date.getDate() - (parsed.daysAgo ?? 0))

  const tx: PendingTx = {
    id: String(Date.now()),
    amount: parsed.amount,
    type: parsed.type,
    categoryGuess: parsed.categoryGuess,
    merchant: parsed.merchant,
    currency: parsed.currency || 'RUB',
    comment: parsed.comment,
    date: date.toISOString(),
    createdAt: new Date().toISOString(),
    source,
    rawText,
  }

  try {
    await addPendingTx(userId, tx)
  } catch (e) {
    console.error('kv error:', (e as Error).message)
    await sendBotMessage(userId, { text: '❌ Не получилось сохранить. Попробуй ещё раз.' })
    return
  }

  const cardText = formatTxCard(tx, parsed.daysAgo ?? 0)
  await sendBotMessage(userId, {
    text: cardText,
    inlineKeyboard: [
      [{ text: '✅ Добавить', callback_data: `add:${tx.id}` }],
      [
        { text: '❌ Отмена', callback_data: `cancel:${tx.id}` },
        { text: '📱 В приложении', url: APP_URL },
      ],
    ],
  })
}

const handleCallback = async (cb: NonNullable<TgUpdate['callback_query']>) => {
  const userId = String(cb.from.id)
  const data = cb.data ?? ''
  const [action, txId] = data.split(':')
  const msg = cb.message

  if (action === 'cancel' && txId && msg) {
    try { await removePendingTx(userId, txId) } catch {}
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '❌ Отменено',
      inlineKeyboard: [[{ text: 'Открыть приложение', url: APP_URL }]],
    }).catch(() => {})
    await answerCallback(cb.id, 'Отменено').catch(() => {})
    return json({ ok: true })
  }

  if (action === 'add' && txId && msg) {
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '✅ Добавлено!\n\nОткрой приложение, чтобы увидеть операцию.',
      inlineKeyboard: [[{ text: '📱 Открыть Сохранёнки', url: APP_URL }]],
    }).catch(() => {})
    await answerCallback(cb.id, 'Добавлено').catch(() => {})
    return json({ ok: true })
  }

  await answerCallback(cb.id).catch(() => {})
  return json({ ok: true })
}
