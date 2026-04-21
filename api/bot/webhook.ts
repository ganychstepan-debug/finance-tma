/**
 * POST /api/bot/webhook
 * Обрабатывает сообщения юзера: /start, /help, текст, голос, нажатия inline-кнопок.
 */

import { json } from '../_shared'
import { sendBotMessage, editBotMessage, answerCallback, escapeHtml } from '../_bot'
import { setPendingReferral, addPendingTx, removePendingTx, type PendingTx } from '../_kv'
import { parseExpensePhrases } from '../_parser'

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
      + `💬 Пиши одну или несколько операций: <i>«кофе 300, такси 500»</i>\n`
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
        + `Можно несколько сразу:\n`
        + `• <code>кофе 300, такси 500, зарплата 80к</code>\n\n`
        + `Открой приложение — подтверди каждую операцию одним тапом.`,
    })
    return json({ ok: true })
  }

  await handlePhrase(userId, text, 'text')
  return json({ ok: true })
}

const handlePhrase = async (userId: string, rawText: string, source: 'text' | 'voice') => {
  if (rawText.length > 500) {
    await sendBotMessage(userId, { text: '⚠ Слишком длинное сообщение. Максимум 500 символов.' })
    return
  }

  let parsedList: Awaited<ReturnType<typeof parseExpensePhrases>>
  try {
    parsedList = await parseExpensePhrases(rawText)
  } catch (e) {
    console.error('parse error:', (e as Error).message)
    await sendBotMessage(userId, { text: '❌ Не получилось распознать. Попробуй ещё раз или открой приложение.' })
    return
  }

  if (parsedList.length === 0) {
    await sendBotMessage(userId, {
      text:
        `🤔 Не понял. Напиши так:\n`
        + `<code>такси 500</code>\n`
        + `<code>пятёрочка 1500</code>\n`
        + `<code>кофе 300 и такси 500</code>`,
    })
    return
  }

  // Сохраняем все в KV
  const txList: PendingTx[] = []
  for (let i = 0; i < parsedList.length; i++) {
    const parsed = parsedList[i]
    const date = new Date()
    date.setDate(date.getDate() - (parsed.daysAgo ?? 0))
    const tx: PendingTx = {
      id: `${Date.now()}_${i}`,
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
      txList.push(tx)
      console.log(`[webhook] saved pending for userId=${userId} id=${tx.id}`)
    } catch (e) {
      console.error('kv error:', (e as Error).message)
    }
  }

  if (txList.length === 0) {
    await sendBotMessage(userId, { text: '❌ Не получилось сохранить. Попробуй ещё раз.' })
    return
  }

  // Одна операция — показываем карточку как раньше
  if (txList.length === 1) {
    const tx = txList[0]
    const parsed = parsedList[0]
    const cardText = formatTxCard(tx, parsed.daysAgo ?? 0)
    await sendBotMessage(userId, {
      text: cardText,
      inlineKeyboard: [
        [{ text: '📱 Открыть в приложении', url: APP_URL }],
        [{ text: '❌ Отменить', callback_data: `cancel:${tx.id}` }],
      ],
    })
    return
  }

  // Много операций — сводка + кнопка в приложение
  let summary = `✅ Распознал <b>${txList.length}</b> операций:\n\n`
  for (const tx of txList) {
    const sign = tx.type === 'expense' ? '−' : '+'
    const emoji = CATEGORY_EMOJI[tx.categoryGuess] || '📌'
    const cur = CURRENCY_SIGN[tx.currency] || tx.currency
    summary += `${emoji} ${sign}${tx.amount.toLocaleString('ru-RU')} ${cur}`
    if (tx.merchant) summary += ` · ${escapeHtml(tx.merchant)}`
    summary += `\n`
  }
  summary += `\nОткрой приложение — подтверди каждую.`

  await sendBotMessage(userId, {
    text: summary,
    inlineKeyboard: [
      [{ text: '📱 Открыть Сохранёнки', url: APP_URL }],
      [{ text: '❌ Отменить все', callback_data: `cancel_all` }],
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

  if (action === 'cancel_all' && msg) {
    // Удаляем ВСЕ pending юзера
    try {
      const { getPendingTxList, removePendingTx } = await import('../_kv')
      const list = await getPendingTxList(userId)
      for (const t of list) {
        try { await removePendingTx(userId, t.id) } catch {}
      }
    } catch {}
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '❌ Все операции отменены',
      inlineKeyboard: [[{ text: 'Открыть приложение', url: APP_URL }]],
    }).catch(() => {})
    await answerCallback(cb.id, 'Отменено').catch(() => {})
    return json({ ok: true })
  }

  // Старый 'add' — поддерживаем для совместимости старых карточек
  if (action === 'add' && txId && msg) {
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '✅ Жди в приложении!\n\nОткрой Сохранёнки — там будет окно подтверждения.',
      inlineKeyboard: [[{ text: '📱 Открыть Сохранёнки', url: APP_URL }]],
    }).catch(() => {})
    await answerCallback(cb.id, 'Открой приложение').catch(() => {})
    return json({ ok: true })
  }

  await answerCallback(cb.id).catch(() => {})
  return json({ ok: true })
}
