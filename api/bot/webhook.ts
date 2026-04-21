/**
 * Telegram Bot webhook.
 *
 * v0.58:
 *   • Сводка 2+ операций теперь имеет 3 кнопки:
 *       ❌ Отменить все         (callback_data: cancel_all)
 *       ✅ Добавить все          (callback_data: confirm_all)
 *       📱 Добавить в приложении (url-кнопка — открывает Mini App и показывает 3.09)
 *   • Новый callback `confirm_all` — перезаписывает все pending юзера с флагом
 *     autoConfirmed: true. Приложение при следующем открытии сразу материализует
 *     их в store (без модалки 3.09).
 */

import { parseExpensePhrases } from '../_parser'
import {
  addPendingTx,
  removePendingTx,
  getPendingTxList,
  type PendingTx,
} from '../_kv'

const BOT_TOKEN = (typeof process !== 'undefined' ? process.env?.BOT_TOKEN : undefined) ?? ''
const APP_URL = (typeof process !== 'undefined' ? process.env?.APP_URL : undefined)
  ?? 'https://t.me/savemoney_gs_bot/app'

// ---------- Telegram types (минимум) ----------
interface TgMessage {
  message_id: number
  chat: { id: number }
  from?: { id: number; first_name?: string; username?: string }
  text?: string
  voice?: { file_id: string; transcription?: string }
}
interface TgCallback {
  id: string
  data?: string
  from: { id: number }
  message?: TgMessage
}
interface TgUpdate {
  message?: TgMessage
  callback_query?: TgCallback
}
type InlineButton = { text: string; callback_data?: string; url?: string }
type InlineKeyboard = InlineButton[][]

// ---------- Helpers ----------
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const tgApi = async (method: string, payload: Record<string, unknown>) => {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN missing')
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res
}

const sendBotMessage = async (
  chatId: string | number,
  opts: { text: string; inlineKeyboard?: InlineKeyboard },
): Promise<{ message_id: number } | null> => {
  const res = await tgApi('sendMessage', {
    chat_id: chatId,
    text: opts.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: opts.inlineKeyboard ? { inline_keyboard: opts.inlineKeyboard } : undefined,
  })
  try {
    const data = await res.json() as { ok?: boolean; result?: { message_id?: number } }
    if (data?.ok && data.result?.message_id) {
      return { message_id: data.result.message_id }
    }
  } catch {}
  return null
}

const editBotMessage = async (
  chatId: string | number,
  messageId: number,
  opts: { text: string; inlineKeyboard?: InlineKeyboard },
): Promise<{ ok: boolean }> => {
  const res = await tgApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: opts.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: opts.inlineKeyboard ? { inline_keyboard: opts.inlineKeyboard } : undefined,
  })
  try {
    const data = await res.json() as { ok?: boolean }
    return { ok: Boolean(data?.ok) }
  } catch {
    return { ok: false }
  }
}

const answerCallback = async (id: string, text?: string) =>
  tgApi('answerCallbackQuery', { callback_query_id: id, text })

// v0.83: индикатор «бот печатает…»
const sendChatAction = async (chatId: string | number, action: 'typing' | 'record_voice' = 'typing') =>
  tgApi('sendChatAction', { chat_id: chatId, action }).catch(() => {})

// ---------- Category/currency icons для карточек в чате ----------
const CATEGORY_EMOJI: Record<string, string> = {
  'Еда': '🍔', 'Продукты': '🛒', 'Транспорт': '🚕', 'Кафе': '☕', 'Связь': '📱',
  'Развлечения': '🎬', 'Здоровье': '💊', 'Одежда': '👕', 'Дом': '🏠', 'Путешествия': '✈️',
  'Подарки': '🎁', 'Образование': '📚', 'Спорт': '🏋️', 'Дети': '👶', 'Прочее': '📌',
  'Другое': '📌', 'Зарплата': '💰', 'Подработка': '💵', 'Доход': '💰',
}
const CURRENCY_SIGN: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥',
  KZT: '₸', BYN: 'Br', UAH: '₴', CHF: '₣', GEL: '₾', AED: 'د.إ', INR: '₹', TRY: '₺',
}

const formatTxCard = (tx: PendingTx, daysAgo: number) => {
  const sign = tx.type === 'expense' ? '−' : '+'
  const emoji = CATEGORY_EMOJI[tx.categoryGuess] || '📌'
  const cur = CURRENCY_SIGN[tx.currency] || tx.currency
  const when = daysAgo === 0 ? 'сегодня' : daysAgo === 1 ? 'вчера' : `${daysAgo} дн. назад`
  let out = `${emoji} <b>${sign}${tx.amount.toLocaleString('ru-RU')} ${cur}</b>\n`
  out += `<i>${escapeHtml(tx.categoryGuess)}</i>`
  if (tx.merchant) out += ` · ${escapeHtml(tx.merchant)}`
  out += `\n📅 ${when}`
  if (tx.comment) out += `\n💬 ${escapeHtml(tx.comment)}`
  return out
}

// ---------- /start, /help ----------
const handleStart = async (userId: string, firstName: string) => {
  const greet =
    `Привет, <b>${escapeHtml(firstName)}</b>! 👋\n\n`
    + `<b>Сохранёнки</b> — учёт финансов прямо в Telegram.\n\n`
    + `💬 Пиши одну или несколько операций: <i>«кофе 300, такси 500»</i>\n`
    + `🎤 Или голосом (Telegram Premium)\n`
    + `📸 В приложении — скан чеков, статистика, цели\n\n`
    + `Жми кнопку 👇`
  await sendBotMessage(userId, {
    text: greet,
    inlineKeyboard: [[{ text: '📱 Открыть Сохранёнки', url: APP_URL }]],
  })
}

const handleHelp = async (userId: string) => {
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
      + `После распознавания:\n`
      + `• <b>Добавить все</b> — если всё верно, операции появятся в приложении автоматически\n`
      + `• <b>В приложении</b> — подтвердить каждую вручную (можно поменять счёт/категорию)\n`
      + `• <b>Отменить</b> — удалить всё`,
  })
}

// ---------- handlePhrase ----------
const handlePhrase = async (userId: string, rawText: string, source: 'text' | 'voice') => {
  if (rawText.length > 500) {
    await sendBotMessage(userId, { text: '⚠ Слишком длинное сообщение. Максимум 500 символов.' })
    return
  }

  // v0.83: индикатор «бот печатает» + плейсхолдер-сообщение, которое будет
  // отредактировано финальным результатом (или удалено если решили слать новое).
  sendChatAction(userId, 'typing')
  const placeholderText = source === 'voice' ? '🎤 Слушаю и распознаю…' : '⏳ Распознаю…'
  const placeholder = await sendBotMessage(userId, { text: placeholderText })
  const placeholderId = placeholder?.message_id

  // Хелпер: если есть плейсхолдер — редактируем, иначе шлём новое
  const reply = async (text: string, keyboard?: InlineKeyboard) => {
    if (placeholderId) {
      const ok = await editBotMessage(userId, placeholderId, { text, inlineKeyboard: keyboard })
        .then((r) => r.ok)
        .catch(() => false)
      if (ok) return
    }
    await sendBotMessage(userId, { text, inlineKeyboard: keyboard })
  }

  let parsedList: Awaited<ReturnType<typeof parseExpensePhrases>>
  try {
    parsedList = await parseExpensePhrases(rawText)
  } catch (e) {
    console.error('parse error:', (e as Error).message)
    await reply('❌ Не получилось распознать. Попробуй ещё раз или открой приложение.')
    return
  }

  if (parsedList.length === 0) {
    await reply(
      `🤔 Не понял. Напиши так:\n`
      + `<code>такси 500</code>\n`
      + `<code>пятёрочка 1500</code>\n`
      + `<code>кофе 300 и такси 500</code>`,
    )
    return
  }

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
      autoConfirmed: false,
    } as PendingTx
    try {
      await addPendingTx(userId, tx)
      txList.push(tx)
    } catch (e) {
      console.error('kv error:', (e as Error).message)
    }
  }

  if (txList.length === 0) {
    await reply('❌ Не получилось сохранить. Попробуй ещё раз.')
    return
  }

  // ---- ОДНА ОПЕРАЦИЯ ----
  if (txList.length === 1) {
    const tx = txList[0]
    const parsed = parsedList[0]
    const cardText = formatTxCard(tx, parsed.daysAgo ?? 0)
    await reply(cardText, [
      [{ text: '✅ Добавить', callback_data: `confirm:${tx.id}` }],
      [{ text: '❌ Отменить', callback_data: `cancel:${tx.id}` }],
    ])
    return
  }

  // ---- НЕСКОЛЬКО ОПЕРАЦИЙ ----
  let summary = `✅ Распознал <b>${txList.length}</b> операций:\n\n`
  for (const tx of txList) {
    const sign = tx.type === 'expense' ? '−' : '+'
    const emoji = CATEGORY_EMOJI[tx.categoryGuess] || '📌'
    const cur = CURRENCY_SIGN[tx.currency] || tx.currency
    const amountStr = tx.amount > 0 ? tx.amount.toLocaleString('ru-RU') : '?'
    summary += `${emoji} ${sign}${amountStr} ${cur}`
    if (tx.merchant) summary += ` · ${escapeHtml(tx.merchant)}`
    summary += `\n`
  }
  summary += `\nВсё верно? Жми «Добавить все» — операции попадут в приложение автоматически.`

  await reply(summary, [
    [{ text: '✅ Добавить все', callback_data: 'confirm_all' }],
    [{ text: '❌ Отменить', callback_data: 'cancel_all' }],
  ])
}

// ---------- handleCallback ----------
const handleCallback = async (cb: TgCallback) => {
  const userId = String(cb.from.id)
  const data = cb.data ?? ''
  const [action, txId] = data.split(':')
  const msg = cb.message

  // === confirm одной ===
  if (action === 'confirm' && txId && msg) {
    try {
      const list = await getPendingTxList(userId)
      const tx = list.find((t) => t.id === txId)
      if (tx) {
        await removePendingTx(userId, txId)
        await addPendingTx(userId, { ...tx, autoConfirmed: true } as PendingTx)
      }
    } catch (e) {
      console.error('confirm error:', (e as Error).message)
    }
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '✅ Добавлено. Открой приложение — операция появится в списке.',
    }).catch(() => {})
    await answerCallback(cb.id, 'Добавлено').catch(() => {})
    return json({ ok: true })
  }

  // === confirm_all — помечает ВСЕ pending юзера как autoConfirmed ===
  if (action === 'confirm_all' && msg) {
    let n = 0
    try {
      const list = await getPendingTxList(userId)
      for (const tx of list) {
        if (tx.autoConfirmed) continue
        await removePendingTx(userId, tx.id)
        await addPendingTx(userId, { ...tx, autoConfirmed: true } as PendingTx)
        n++
      }
    } catch (e) {
      console.error('confirm_all error:', (e as Error).message)
    }
    await editBotMessage(msg.chat.id, msg.message_id, {
      text:
        n > 0
          ? `✅ Подтверждено <b>${n}</b> операций.\n\nОткрой приложение — появятся в списке.`
          : '✅ Уже подтверждено. Открой приложение — появятся.',
    }).catch(() => {})
    await answerCallback(cb.id, 'Добавлено').catch(() => {})
    return json({ ok: true })
  }

  // === cancel одной ===
  if (action === 'cancel' && txId && msg) {
    try { await removePendingTx(userId, txId) } catch {}
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '❌ Отменено',
    }).catch(() => {})
    await answerCallback(cb.id, 'Отменено').catch(() => {})
    return json({ ok: true })
  }

  // === cancel_all — чистит всё ===
  if (action === 'cancel_all' && msg) {
    try {
      const list = await getPendingTxList(userId)
      for (const t of list) {
        try { await removePendingTx(userId, t.id) } catch {}
      }
    } catch {}
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '❌ Все операции отменены',
    }).catch(() => {})
    await answerCallback(cb.id, 'Отменено').catch(() => {})
    return json({ ok: true })
  }

  // === legacy `add:` — старые карточки ===
  if (action === 'add' && txId && msg) {
    try {
      const list = await getPendingTxList(userId)
      const tx = list.find((t) => t.id === txId)
      if (tx) {
        await removePendingTx(userId, txId)
        await addPendingTx(userId, { ...tx, autoConfirmed: true } as PendingTx)
      }
    } catch {}
    await editBotMessage(msg.chat.id, msg.message_id, {
      text: '✅ Добавлено. Открой приложение — операция появится в списке.',
    }).catch(() => {})
    await answerCallback(cb.id, 'Добавлено').catch(() => {})
    return json({ ok: true })
  }

  await answerCallback(cb.id).catch(() => {})
  return json({ ok: true })
}

// ---------- entrypoint ----------
export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)
  let update: TgUpdate
  try {
    update = await req.json()
  } catch {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  try {
    if (update.callback_query) {
      return await handleCallback(update.callback_query)
    }

    const msg = update.message
    if (!msg || !msg.from) return json({ ok: true })
    const userId = String(msg.from.id)
    const firstName = msg.from.first_name || 'друг'

    const text = msg.text?.trim() ?? ''

    if (text === '/start') {
      await handleStart(userId, firstName)
      return json({ ok: true })
    }
    if (text === '/help') {
      await handleHelp(userId)
      return json({ ok: true })
    }

    // голос — только premium (у обычных юзеров transcription отсутствует)
    if (msg.voice) {
      const transcription = msg.voice.transcription
      if (transcription) {
        await handlePhrase(userId, transcription, 'voice')
      } else {
        await sendBotMessage(userId, {
          text: '🎤 Голос пока работает только у Telegram Premium. Напиши текстом, пожалуйста.',
        })
      }
      return json({ ok: true })
    }

    if (text) {
      await handlePhrase(userId, text, 'text')
      return json({ ok: true })
    }

    return json({ ok: true })
  } catch (e) {
    console.error('webhook error:', (e as Error).message)
    return json({ ok: false, error: 'handler' }, 500)
  }
}
