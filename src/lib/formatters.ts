import type { Currency } from '@/types'

// Известные символы. Для неизвестных — возвращаем код.
const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
  BYN: 'Br',
  UAH: '₴',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  TRY: '₺',
  INR: '₹',
  CHF: '₣',
  AED: 'د.إ',
  GEL: '₾',
  AMD: '֏',
  AZN: '₼',
  THB: '฿',
  KRW: '₩',
  VND: '₫',
}

export const currencySign = (c: Currency): string => CURRENCY_SYMBOLS[c] ?? c

export const formatMoney = (amount: number, currency: Currency = 'RUB'): string => {
  const absRounded = Math.round(Math.abs(amount))
  const formatted = absRounded.toLocaleString('ru-RU')
  const sign = amount < 0 ? '−' : ''
  return `${sign}${formatted} ${currencySign(currency)}`
}

export const formatMoneyShort = (amount: number): string => {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return (abs / 1_000_000).toFixed(1) + 'М'
  if (abs >= 1_000) return (abs / 1_000).toFixed(0) + 'К'
  return String(Math.round(abs))
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export const formatDate = (iso: string): string => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return 'Сегодня'
  if (sameDay(d, yesterday)) return 'Вчера'
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const formatMonth = (date: Date): string => {
  return `${MONTHS_NOM[date.getMonth()]} ${date.getFullYear()}`
}

export const monthRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}
