/**
 * Клиент для работы с pending-транзакциями из бота.
 * Бот принимает голос/текст, парсит, кладёт в KV.
 * Mini App при открытии проверяет список и показывает подтверждение.
 */

import { getInitData } from './telegram'

export interface BotPendingTx {
  id: string
  amount: number
  type: 'expense' | 'income'
  categoryGuess: string
  merchant?: string
  currency: string
  comment?: string
  date: string
  createdAt: string
  source: 'text' | 'voice'
  rawText: string
  /** v0.58: пользователь в боте нажал «Добавить все» — в приложении не показывать модалку, сразу материализовать */
  autoConfirmed?: boolean
}

const BASE_URL = '/api/bot/pending'

export const fetchPendingTxs = async (): Promise<BotPendingTx[]> => {
  const initData = getInitData()
  if (!initData) return []
  try {
    const res = await fetch(BASE_URL, {
      method: 'GET',
      headers: { 'X-Telegram-Init-Data': initData },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

export const removePendingTx = async (txId: string): Promise<boolean> => {
  const initData = getInitData()
  if (!initData) return false
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
      },
      body: JSON.stringify({ txId }),
    })
    return res.ok
  } catch {
    return false
  }
}
