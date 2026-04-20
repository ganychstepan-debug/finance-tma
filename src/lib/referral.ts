// Реферальная система — клиент.
//
// Логика (серверная часть — api/referral/* и api/bot/webhook):
// 1. У каждого юзера реф-код = его user.id из Telegram.
// 2. Ссылка: https://t.me/{bot}?start=ref_{id} — ведёт в БОТА (не сразу в Mini App),
//    чтобы бот поймал /start ref_<id>, зафиксил pending и показал приветствие.
// 3. Когда приглашённый проходит онбординг — Mini App дёргает /api/referral/complete.
//    Сервер проверяет initData, инкрементит счётчик пригласителя и шлёт ему уведомление.
// 4. Экран рефералки подгружает счётчик с /api/referral/stats.

import { getUser } from './telegram'

export const BOT_USERNAME = 'savemoney_gs_bot'

export const getReferralLink = (): string => {
  const user = getUser()
  const base = `https://t.me/${BOT_USERNAME}`
  if (!user?.id) return base
  return `${base}?start=ref_${user.id}`
}

export const getShareMessage = (): string => {
  return '💰 Попробуй Сохранёнки — учёт финансов прямо в Telegram. Быстро и бесплатно.'
}

// ============================================================================
// Локальный счётчик нажатий «Поделиться» (для истории)
// ============================================================================

const SHARE_COUNT_KEY = 'referral_share_count'

export const getShareCount = (): number => {
  try {
    const raw = localStorage.getItem(SHARE_COUNT_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return isNaN(n) ? 0 : n
  } catch {
    return 0
  }
}

export const incrementShareCount = (): number => {
  try {
    const next = getShareCount() + 1
    localStorage.setItem(SHARE_COUNT_KEY, String(next))
    return next
  } catch {
    return 0
  }
}

// ============================================================================
// Серверные вызовы
// ============================================================================

const initData = (): string => {
  try {
    return (window as any).Telegram?.WebApp?.initData ?? ''
  } catch {
    return ''
  }
}

/**
 * Дёргается один раз после онбординга. Идемпотентно — сервер проверяет что
 * этот юзер ещё не был зачтён.
 */
export const completeReferralOnServer = async (): Promise<boolean> => {
  const data = initData()
  if (!data) return false
  try {
    const res = await fetch('/api/referral/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': data,
      },
    })
    if (!res.ok) return false
    const body = await res.json()
    return Boolean(body?.confirmed)
  } catch {
    return false
  }
}

/**
 * Подтянуть число подтверждённых приглашений с сервера.
 * Возвращает null при ошибке — UI покажет прочерк.
 */
export const fetchReferralCount = async (): Promise<number | null> => {
  const data = initData()
  if (!data) return null
  try {
    const res = await fetch('/api/referral/stats', {
      method: 'GET',
      headers: { 'X-Telegram-Init-Data': data },
    })
    if (!res.ok) return null
    const body = await res.json()
    if (typeof body?.count === 'number') return body.count
    return null
  } catch {
    return null
  }
}
