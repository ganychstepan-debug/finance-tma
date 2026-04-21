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
}

const BASE_URL = '/api/bot/pending'

export const fetchPendingTxs = async (): Promise<BotPendingTx[]> => {
  const initData = getInitData()
  if (!initData) {
    console.warn('[botPending] no initData — not running in Telegram?')
    return []
  }
  try {
    const res = await fetch(BASE_URL, {
      method: 'GET',
      headers: { 'X-Telegram-Init-Data': initData },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[botPending] fetch failed ${res.status}:`, errText.slice(0, 200))
      return []
    }
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    console.log(`[botPending] got ${items.length} items`)
    return items
  } catch (e) {
    console.warn('[botPending] fetch error:', (e as Error).message)
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
