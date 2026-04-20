import type { AppState, Transaction } from '@/types'

// ============================================================================
// CSV экспорт
// ============================================================================

const escapeCsv = (val: string | number | undefined): string => {
  if (val == null) return ''
  const s = String(val)
  // Экранируем кавычки и оборачиваем в них, если есть спец.символы
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const typeLabel: Record<string, string> = {
  expense: 'Расход',
  income: 'Доход',
  transfer: 'Перевод',
}

const formatDateForCsv = (iso: string): string => {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

/**
 * Экспорт транзакций в CSV (разделитель «;» — Excel RU-локали любит точку с запятой).
 */
export const exportTransactionsCSV = (
  state: AppState,
  from?: Date,
  to?: Date,
): string => {
  const fromT = from ? from.getTime() : -Infinity
  const toT   = to   ? to.getTime()   : +Infinity

  const txs = state.transactions
    .filter((t) => {
      const d = new Date(t.date).getTime()
      return d >= fromT && d <= toT
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const rows: string[] = []
  // BOM чтобы Excel корректно открывал UTF-8
  const BOM = '\uFEFF'

  // Заголовок
  rows.push(['Дата', 'Тип', 'Сумма', 'Валюта', 'Счёт', 'Категория', 'Комментарий'].join(';'))

  for (const tx of txs) {
    const acc = state.accounts.find((a) => a.id === tx.accountId)
    const cat = state.categories.find((c) => c.id === tx.categoryId)
    const toAcc = tx.toAccountId ? state.accounts.find((a) => a.id === tx.toAccountId) : null

    rows.push([
      formatDateForCsv(tx.date),
      typeLabel[tx.type] ?? tx.type,
      tx.amount,
      tx.currency,
      acc?.name ?? '(удалён)',
      tx.type === 'transfer'
        ? `→ ${toAcc?.name ?? '(удалён)'}`
        : (cat?.name ?? '(без категории)'),
      tx.comment ?? '',
    ].map(escapeCsv).join(';'))
  }

  return BOM + rows.join('\r\n')
}

/**
 * Пустой шаблон CSV для импорта
 */
export const emptyTemplateCSV = (): string => {
  const BOM = '\uFEFF'
  const header = ['Дата', 'Тип', 'Сумма', 'Валюта', 'Счёт', 'Категория', 'Комментарий'].join(';')
  const example = [
    '2026-04-19 12:00;Расход;500;RUB;Тинькофф;Еда;Обед',
    '2026-04-19 18:00;Доход;100000;RUB;Тинькофф;Зарплата;',
    '2026-04-18 09:30;Расход;320;RUB;Тинькофф;Транспорт;Такси',
  ].join('\r\n')
  return BOM + header + '\r\n' + example
}

/**
 * Скачать или поделиться файлом.
 * Логика выбора:
 * 1. В Telegram WebView (или там где поддержан Share with files) — native share sheet
 * 2. Fallback — обычное скачивание через <a download>
 */
export const downloadFile = async (
  filename: string,
  content: string,
  mime = 'text/csv'
): Promise<'shared' | 'downloaded' | 'error'> => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })

  // Пытаемся поделиться через native share sheet (iOS, Android)
  // Это единственный способ получить нормальный файл из Telegram WebView
  try {
    const file = new File([blob], filename, { type: mime })
    // Проверяем: nav.canShare может не быть, проверяем безопасно
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).canShare === 'function' &&
      (navigator as any).canShare({ files: [file] })

    if (canShareFiles) {
      await (navigator as any).share({
        files: [file],
        title: 'Finance export',
        text: `Экспорт финансов: ${filename}`,
      })
      return 'shared'
    }
  } catch (e: any) {
    // Юзер закрыл share sheet — не считаем ошибкой
    if (e?.name === 'AbortError') return 'shared'
    console.warn('share failed, fallback to download', e)
  }

  // Fallback: обычное скачивание
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch (e) {
    console.error('download failed', e)
    return 'error'
  }
}

/**
 * Проверка: поддерживает ли браузер шаринг файлов.
 * Используем для подсказки пользователю.
 */
export const canShareFiles = (): boolean => {
  if (typeof navigator === 'undefined') return false
  if (typeof (navigator as any).canShare !== 'function') return false
  try {
    const testFile = new File(['test'], 'test.csv', { type: 'text/csv' })
    return (navigator as any).canShare({ files: [testFile] })
  } catch {
    return false
  }
}

// ============================================================================
// CSV импорт (для Sprint 3.8)
// ============================================================================

export interface ImportRow {
  date: string
  type: 'expense' | 'income' | 'transfer'
  amount: number
  currency: string
  accountName: string
  categoryName: string
  comment?: string
}

export interface ImportResult {
  rows: ImportRow[]
  errors: string[]
}

const parseType = (s: string): ImportRow['type'] | null => {
  const v = s.trim().toLowerCase()
  if (v === 'расход' || v === 'expense') return 'expense'
  if (v === 'доход' || v === 'income') return 'income'
  if (v === 'перевод' || v === 'transfer') return 'transfer'
  return null
}

/**
 * Парсер строки CSV с учётом кавычек (простой, но надёжный для нашего формата).
 */
const parseCsvLine = (line: string, sep: ';' | ',' = ';'): string[] => {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuote = false }
      } else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === sep) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

export const parseImportCSV = (text: string): ImportResult => {
  const errors: string[] = []
  const rows: ImportRow[] = []

  // Убираем BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    errors.push('Файл пустой')
    return { rows, errors }
  }

  // Определяем разделитель по первой строке (эвристика)
  const first = lines[0]
  const sep: ';' | ',' = first.split(';').length > first.split(',').length ? ';' : ','

  // Пропускаем заголовок если в нём нет цифр (значит это шапка)
  const hasHeader = !/\d/.test(lines[0])
  const dataLines = hasHeader ? lines.slice(1) : lines

  dataLines.forEach((line, idx) => {
    const cells = parseCsvLine(line, sep).map((c) => c.trim())
    const lineNo = idx + (hasHeader ? 2 : 1)

    if (cells.length < 5) {
      errors.push(`Строка ${lineNo}: недостаточно колонок (минимум 5: дата, тип, сумма, валюта, счёт)`)
      return
    }

    const [dateStr, typeStr, amountStr, currencyRaw, accountName, categoryName = '', comment = ''] = cells

    const dateParsed = Date.parse(dateStr.replace(' ', 'T'))
    if (isNaN(dateParsed)) {
      errors.push(`Строка ${lineNo}: неверная дата «${dateStr}». Формат: YYYY-MM-DD или YYYY-MM-DD HH:MM`)
      return
    }
    const type = parseType(typeStr)
    if (!type) {
      errors.push(`Строка ${lineNo}: неизвестный тип «${typeStr}». Нужно: Расход, Доход или Перевод`)
      return
    }
    const amount = Number(String(amountStr).replace(',', '.'))
    if (!isFinite(amount) || amount <= 0) {
      errors.push(`Строка ${lineNo}: сумма должна быть числом > 0, получено «${amountStr}»`)
      return
    }
    const currency = (currencyRaw || 'RUB').toUpperCase()
    if (!accountName) {
      errors.push(`Строка ${lineNo}: не указан счёт`)
      return
    }

    rows.push({
      date: new Date(dateParsed).toISOString(),
      type,
      amount,
      currency,
      accountName,
      categoryName,
      comment: comment || undefined,
    })
  })

  return { rows, errors }
}
