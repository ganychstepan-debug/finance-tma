import type { Currency } from '@/types'

// ============================================================================
// Курсы валют с ЦБ РФ (бесплатное API)
// ============================================================================
// https://www.cbr-xml-daily.ru — дневные курсы, обновляются раз в сутки.
// Формат: { Valute: { USD: { Value: 93.56, Nominal: 1 }, ... } }
// Все курсы приведены к RUB.

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'
const LS_RATES_KEY = 'fx_rates'
const TTL_MS = 24 * 60 * 60 * 1000 // 1 сутки

export interface Rates {
  // rates[X] = сколько RUB стоит 1 X (например, rates.USD = 93.5)
  [code: string]: number
}

interface RatesCache {
  rates: Rates
  fetchedAt: number
}

// Fallback если API недоступен — приблизительные курсы на апрель 2026
const FALLBACK_RATES: Rates = {
  RUB: 1,
  USD: 93,
  EUR: 101,
  KZT: 0.21,
  BYN: 28,
  UAH: 2.3,
  GBP: 118,
  JPY: 0.62,
  CNY: 13,
  TRY: 2.9,
  CHF: 105,
  GEL: 35,
  AED: 25,
  INR: 1.1,
}

let memory: RatesCache | null = null

const loadFromStorage = (): RatesCache | null => {
  try {
    const raw = localStorage.getItem(LS_RATES_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RatesCache
  } catch {
    return null
  }
}

const saveToStorage = (c: RatesCache): void => {
  try {
    localStorage.setItem(LS_RATES_KEY, JSON.stringify(c))
  } catch {}
}

/**
 * Получить курсы. Логика:
 * 1. Если в памяти свежий — вернуть
 * 2. Если в LocalStorage свежий — вернуть
 * 3. Сходить в API ЦБ РФ, закэшировать
 * 4. Если API недоступен — вернуть старый кэш или fallback
 */
export const getRates = async (force = false): Promise<Rates> => {
  const now = Date.now()

  if (!force && memory && now - memory.fetchedAt < TTL_MS) {
    return memory.rates
  }

  if (!force && !memory) memory = loadFromStorage()
  if (!force && memory && now - memory.fetchedAt < TTL_MS) {
    return memory.rates
  }

  try {
    const res = await fetch(CBR_URL, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as {
      Valute: Record<string, { Value: number; Nominal: number }>
    }
    const rates: Rates = { RUB: 1 }
    for (const [code, v] of Object.entries(data.Valute)) {
      rates[code] = v.Value / v.Nominal
    }
    memory = { rates, fetchedAt: now }
    saveToStorage(memory)
    return rates
  } catch (e) {
    console.warn('CBR fetch failed, using fallback', e)
    // Если в LS что-то есть пусть даже старое — вернём
    if (memory) return memory.rates
    return FALLBACK_RATES
  }
}

/**
 * Синхронный вариант: вернуть текущий закэшированный rates (или fallback).
 * Используется в компонентах. Перед первым отрисом надо дёрнуть getRates().
 */
export const getRatesSync = (): Rates => {
  if (memory) return memory.rates
  const fromStorage = loadFromStorage()
  if (fromStorage) {
    memory = fromStorage
    return fromStorage.rates
  }
  return FALLBACK_RATES
}

/**
 * Конвертация суммы из одной валюты в другую.
 * rates[X] = сколько RUB стоит 1 X. Значит:
 *   RUB = X * rates[X]
 *   Y = RUB / rates[Y]
 */
export const convert = (
  amount: number,
  from: Currency,
  to: Currency,
  rates?: Rates,
): number => {
  if (from === to) return amount
  const r = rates ?? getRatesSync()
  const rubAmount = amount * (r[from] ?? 1)
  const targetRate = r[to] ?? 1
  if (targetRate === 0) return 0
  return rubAmount / targetRate
}

/**
 * Свежесть кэша (в часах). -1 если нет данных.
 */
export const ratesAgeHours = (): number => {
  const c = memory ?? loadFromStorage()
  if (!c) return -1
  return Math.round((Date.now() - c.fetchedAt) / (60 * 60 * 1000))
}
