/**
 * Обёртка над Telegram Bot API.
 * Шлёт сообщения юзерам через бота @savemoney_gs_bot.
 *
 * Требует BOT_TOKEN в env (получается в BotFather).
 */

const BOT_TOKEN = (globalThis as any).process?.env?.BOT_TOKEN
  ?? (typeof process !== 'undefined' ? process.env?.BOT_TOKEN : undefined)

const APP_URL = 'https://t.me/savemoney_gs_bot/finance'

interface SendMessageOptions {
  text: string
  /** Не бипать — для ненавязчивых напоминаний */
  silent?: boolean
  /** Добавить кнопку "Открыть приложение" */
  withOpenButton?: boolean
  /** Пользовательские inline-кнопки */
  inlineKeyboard?: { text: string; url?: string; callback_data?: string }[][]
}

export interface SendResult {
  ok: boolean
  errorCode?: number
  errorDescription?: string
}

/**
 * Шлёт сообщение юзеру.
 * Возвращает {ok: true} при успехе, иначе детали ошибки.
 *
 * Частые ошибки:
 *   403 "bot was blocked by the user" — юзер заблокировал бота
 *   400 "chat not found" — юзер не стартовал бота
 *   429 — rate limit (слишком быстро шлём)
 */
export const sendBotMessage = async (
  telegramId: string | number,
  opts: SendMessageOptions,
): Promise<SendResult> => {
  if (!BOT_TOKEN) {
    return { ok: false, errorDescription: 'BOT_TOKEN не настроен' }
  }

  let replyMarkup: any = undefined
  if (opts.inlineKeyboard) {
    replyMarkup = { inline_keyboard: opts.inlineKeyboard }
  } else if (opts.withOpenButton) {
    replyMarkup = {
      inline_keyboard: [[{ text: 'Открыть приложение', url: APP_URL }]],
    }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: opts.text,
        parse_mode: 'HTML',
        disable_notification: Boolean(opts.silent),
        reply_markup: replyMarkup,
      }),
    })

    if (res.ok) {
      return { ok: true }
    }

    const data = await res.json().catch(() => ({}))
    return {
      ok: false,
      errorCode: data.error_code ?? res.status,
      errorDescription: data.description ?? 'неизвестная ошибка',
    }
  } catch (e) {
    return {
      ok: false,
      errorDescription: (e as Error).message,
    }
  }
}

/**
 * Escape для HTML parse_mode — защита от инъекций в user-generated тексте.
 */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/**
 * Редактирует уже отправленное сообщение (текст + inline-клавиатуру).
 */
export const editBotMessage = async (
  chatId: number | string,
  messageId: number,
  opts: { text: string; inlineKeyboard?: { text: string; url?: string; callback_data?: string }[][] },
): Promise<SendResult> => {
  if (!BOT_TOKEN) return { ok: false, errorDescription: 'BOT_TOKEN не настроен' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: opts.text,
        parse_mode: 'HTML',
        reply_markup: opts.inlineKeyboard ? { inline_keyboard: opts.inlineKeyboard } : undefined,
      }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, errorCode: data.error_code ?? res.status, errorDescription: data.description ?? 'error' }
  } catch (e) {
    return { ok: false, errorDescription: (e as Error).message }
  }
}

/**
 * Отвечает на callback_query — убирает "крутилку" на нажатой кнопке.
 */
export const answerCallback = async (
  callbackQueryId: string,
  text?: string,
): Promise<void> => {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text ?? '',
        show_alert: false,
      }),
    })
  } catch {}
}
