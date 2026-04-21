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
  detectedFormat?: string        // v0.91: какой формат распознан
  needsAI?: boolean              // v0.91: true если нужно пробовать GPT-fallback
}

const parseType = (s: string): ImportRow['type'] | null => {
  const v = s.trim().toLowerCase()
  if (v === 'расход' || v === 'expense' || v === 'trata' || v === 'трата') return 'expense'
  if (v === 'доход' || v === 'income' || v === 'прибыль') return 'income'
  if (v === 'перевод' || v === 'transfer') return 'transfer'
  return null
}

// v0.91: универсальный парсер даты из нескольких форматов
const parseAnyDate = (s: string): string | null => {
  if (!s) return null
  const trimmed = s.trim()
  // Сначала пробуем ISO / нативный Date.parse
  const iso = Date.parse(trimmed.replace(' ', 'T'))
  if (!isNaN(iso)) return new Date(iso).toISOString()

  // DD.MM.YYYY или DD/MM/YYYY или DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) {
    let [, dd, mm, yyyy, hh = '0', mi = '0'] = m
    let year = Number(yyyy)
    if (year < 100) year += 2000
    const d = new Date(Number(year), Number(mm) - 1, Number(dd), Number(hh), Number(mi))
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

const parseAmount = (s: string): { amount: number; isExpense: boolean } | null => {
  if (!s) return null
  let str = String(s).trim()
  // Убираем валютные символы и пробелы-разделители тысяч
  str = str.replace(/[₽$€£¥₺₴₸]/g, '').replace(/\s/g, '').replace(',', '.')
  const isExpense = str.startsWith('-')
  const n = Number(str.replace(/^[+-]/, ''))
  if (!isFinite(n)) return null
  return { amount: Math.abs(n), isExpense }
}

/**
 * Парсер строки CSV с учётом кавычек (простой, но надёжный для нашего формата).
 */
const parseCsvLine = (line: string, sep: ';' | ',' | '\t' | '|' = ';'): string[] => {
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

// v0.91: определяем разделитель автоматически
const detectSeparator = (line: string): ';' | ',' | '\t' | '|' => {
  const counts = {
    ';': line.split(';').length,
    ',': line.split(',').length,
    '\t': line.split('\t').length,
    '|': line.split('|').length,
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as ';' | ',' | '\t' | '|'
}

// ============================================================================
// v0.91: Автодетект формата популярных приложений
// ============================================================================

type FormatKey =
  | 'savmoney'        // наш нативный
  | 'zenmoney'        // Дзен-мани
  | 'coinkeeper'      // CoinKeeper
  | 'monefy'          // Monefy
  | 'moneymanager'    // Money Manager (Realbyte)
  | 'moneylover'      // Money Lover
  | '1money'          // 1Money
  | 'ynab'            // YNAB
  | 'unknown'

interface FormatInfo {
  key: FormatKey
  name: string
}

const detectFormat = (headers: string[]): FormatInfo => {
  const norm = headers.map((h) => h.toLowerCase().trim())
  const has = (...names: string[]) => names.every((n) => norm.some((h) => h.includes(n.toLowerCase())))
  const hasAny = (...names: string[]) => names.some((n) => norm.some((h) => h.includes(n.toLowerCase())))

  // Наш формат
  if (has('дата', 'тип', 'сумма', 'счёт')) return { key: 'savmoney', name: 'Сохранёнки' }
  if (has('date', 'type', 'amount', 'account') && !hasAny('outflow', 'inflow', 'payee')) {
    return { key: 'savmoney', name: 'Сохранёнки' }
  }

  // Дзен-мани: "date;categoryName;payee;comment;outcomeAccountName;outcome;outcomeCurrencyShortTitle;incomeAccountName;income;incomeCurrencyShortTitle;created;..."
  if (hasAny('outcomeaccountname', 'incomeaccountname') || (hasAny('outcome') && hasAny('income'))) {
    return { key: 'zenmoney', name: 'Дзен-мани' }
  }

  // CoinKeeper: "Дата;Сумма;Валюта;Счёт;Категория;Описание" или "Date;Amount;Currency;Account;Category;Note"
  // Отличается от нашего отсутствием колонки "Тип" (знак суммы определяет тип)
  if ((has('дата', 'сумма', 'счёт', 'категория') && !hasAny('тип')) ||
      (has('date', 'amount', 'account', 'category') && !hasAny('type'))) {
    return { key: 'coinkeeper', name: 'CoinKeeper' }
  }

  // Monefy: "date,amount,currency,category,converted amount,converted currency,description"
  if (has('date', 'amount', 'currency', 'category') && hasAny('converted')) {
    return { key: 'monefy', name: 'Monefy' }
  }

  // Money Manager (Realbyte): "Date,Account,Category,Subcategory,Note,Amount,Income/Expense,Description"
  if (hasAny('income/expense') || hasAny('subcategory')) {
    return { key: 'moneymanager', name: 'Money Manager' }
  }

  // Money Lover: "Note,Amount,Category,Date,Wallet,Currency,Event,Exclude Report,Type"
  if (hasAny('wallet') && hasAny('exclude report')) {
    return { key: 'moneylover', name: 'Money Lover' }
  }

  // 1Money: "Date,Type,From account,To account / Category,Amount,Currency,Description"
  if (hasAny('from account') || (hasAny('to account') && hasAny('category'))) {
    return { key: '1money', name: '1Money' }
  }

  // YNAB: "Account,Flag,Date,Payee,Category Group/Category,Category Group,Category,Memo,Outflow,Inflow,Cleared"
  if (hasAny('outflow') && hasAny('inflow')) {
    return { key: 'ynab', name: 'YNAB' }
  }

  return { key: 'unknown', name: 'Неизвестный формат' }
}

// ============================================================================
// Адаптеры форматов
// ============================================================================

const findCol = (headers: string[], ...names: string[]): number => {
  const norm = headers.map((h) => h.toLowerCase().trim())
  for (const n of names) {
    const nn = n.toLowerCase()
    const idx = norm.findIndex((h) => h === nn || h.includes(nn))
    if (idx >= 0) return idx
  }
  return -1
}

// Универсальный адаптер для форматов где есть явные колонки
// (CoinKeeper, Monefy, простые выписки)
const adaptByHeaders = (headers: string[], dataLines: string[], sep: ';' | ',' | '\t' | '|'): ImportResult => {
  const errors: string[] = []
  const rows: ImportRow[] = []

  // Возможные названия колонок
  const dateIdx     = findCol(headers, 'дата', 'date', 'когда')
  const amountIdx   = findCol(headers, 'сумма', 'amount', 'размер', 'value')
  const currencyIdx = findCol(headers, 'валюта', 'currency', 'ccy')
  const accountIdx  = findCol(headers, 'счёт', 'счет', 'account', 'wallet', 'кошелёк', 'кошелек', 'карта')
  const categoryIdx = findCol(headers, 'категория', 'category', 'тип расхода')
  const typeIdx     = findCol(headers, 'тип', 'type', 'направление', 'income/expense')
  const commentIdx  = findCol(headers, 'комментарий', 'комм', 'note', 'memo', 'description', 'описание', 'payee', 'контрагент')
  // YNAB-специфика
  const outflowIdx  = findCol(headers, 'outflow')
  const inflowIdx   = findCol(headers, 'inflow')

  if (dateIdx < 0 || (amountIdx < 0 && outflowIdx < 0)) {
    errors.push('Не удалось найти колонки «Дата» и «Сумма»')
    return { rows, errors, needsAI: true }
  }

  dataLines.forEach((line, idx) => {
    const cells = parseCsvLine(line, sep).map((c) => c.trim())
    if (cells.length < 2) return
    const lineNo = idx + 2

    const dateISO = parseAnyDate(cells[dateIdx] ?? '')
    if (!dateISO) {
      errors.push(`Строка ${lineNo}: не удалось распознать дату «${cells[dateIdx]}»`)
      return
    }

    let amount = 0
    let type: ImportRow['type'] = 'expense'

    // YNAB имеет отдельные колонки Outflow / Inflow
    if (outflowIdx >= 0 && inflowIdx >= 0) {
      const outParsed = parseAmount(cells[outflowIdx] ?? '')
      const inParsed = parseAmount(cells[inflowIdx] ?? '')
      if (outParsed && outParsed.amount > 0) {
        amount = outParsed.amount
        type = 'expense'
      } else if (inParsed && inParsed.amount > 0) {
        amount = inParsed.amount
        type = 'income'
      } else {
        return
      }
    } else {
      const parsed = parseAmount(cells[amountIdx] ?? '')
      if (!parsed || parsed.amount <= 0) {
        errors.push(`Строка ${lineNo}: неверная сумма «${cells[amountIdx]}»`)
        return
      }
      amount = parsed.amount

      // Тип: из колонки type, иначе знак суммы
      if (typeIdx >= 0) {
        const tVal = (cells[typeIdx] ?? '').toLowerCase().trim()
        if (tVal.includes('incom') || tVal.includes('доход') || tVal === 'в') type = 'income'
        else if (tVal.includes('transfer') || tVal.includes('перевод')) type = 'transfer'
        else type = 'expense'
      } else {
        type = parsed.isExpense ? 'expense' : 'expense' // по умолчанию расход; если категория явно доходная — скорректирует сам юзер
        // Уточнение по знаку: если в выписке суммы со знаком, минус = расход, плюс = доход
        if (!parsed.isExpense && (cells[amountIdx] ?? '').trim().startsWith('+')) {
          type = 'income'
        }
      }
    }

    rows.push({
      date: dateISO,
      type,
      amount,
      currency: currencyIdx >= 0 ? ((cells[currencyIdx] ?? 'RUB').toUpperCase() || 'RUB') : 'RUB',
      accountName: accountIdx >= 0 ? (cells[accountIdx] ?? '').trim() || 'Импорт' : 'Импорт',
      categoryName: categoryIdx >= 0 ? (cells[categoryIdx] ?? '').trim() : '',
      comment: commentIdx >= 0 ? (cells[commentIdx] ?? '').trim() || undefined : undefined,
    })
  })

  return { rows, errors }
}

// Дзен-мани: две колонки суммы (outcome/income) и два счёта (outcomeAccountName/incomeAccountName)
const adaptZenmoney = (headers: string[], dataLines: string[], sep: ';' | ',' | '\t' | '|'): ImportResult => {
  const errors: string[] = []
  const rows: ImportRow[] = []

  const dateIdx   = findCol(headers, 'date', 'дата')
  const catIdx    = findCol(headers, 'categoryname', 'category', 'категория')
  const payeeIdx  = findCol(headers, 'payee', 'контрагент')
  const commentIdx = findCol(headers, 'comment', 'note', 'комментарий')
  const outAccIdx = findCol(headers, 'outcomeaccountname')
  const outSumIdx = findCol(headers, 'outcome')
  const outCurIdx = findCol(headers, 'outcomecurrencyshorttitle')
  const inAccIdx  = findCol(headers, 'incomeaccountname')
  const inSumIdx  = findCol(headers, 'income')
  const inCurIdx  = findCol(headers, 'incomecurrencyshorttitle')

  if (dateIdx < 0) {
    errors.push('Дзен-мани: не найдена колонка date')
    return { rows, errors, needsAI: true }
  }

  dataLines.forEach((line, idx) => {
    const cells = parseCsvLine(line, sep).map((c) => c.trim())
    if (cells.length < 3) return
    const lineNo = idx + 2

    const dateISO = parseAnyDate(cells[dateIdx] ?? '')
    if (!dateISO) return

    const outAmt = outSumIdx >= 0 ? Number(String(cells[outSumIdx]).replace(',', '.')) || 0 : 0
    const inAmt  = inSumIdx  >= 0 ? Number(String(cells[inSumIdx]).replace(',', '.')) || 0 : 0
    const outAcc = outAccIdx >= 0 ? cells[outAccIdx] : ''
    const inAcc  = inAccIdx  >= 0 ? cells[inAccIdx] : ''

    const categoryName = catIdx >= 0 ? cells[catIdx] : ''
    const comment = [
      payeeIdx >= 0 ? cells[payeeIdx] : '',
      commentIdx >= 0 ? cells[commentIdx] : '',
    ].filter(Boolean).join(' · ').slice(0, 140) || undefined

    // Перевод: есть и outcome, и income, и разные счета
    if (outAmt > 0 && inAmt > 0 && outAcc && inAcc && outAcc !== inAcc) {
      rows.push({
        date: dateISO,
        type: 'transfer',
        amount: outAmt,
        currency: (outCurIdx >= 0 ? cells[outCurIdx] : 'RUB') || 'RUB',
        accountName: outAcc,
        categoryName: inAcc, // в категорию кладём счёт-получатель (юзер разберётся)
        comment,
      })
      return
    }

    // Расход
    if (outAmt > 0 && outAcc) {
      rows.push({
        date: dateISO,
        type: 'expense',
        amount: outAmt,
        currency: (outCurIdx >= 0 ? cells[outCurIdx] : 'RUB') || 'RUB',
        accountName: outAcc,
        categoryName,
        comment,
      })
      return
    }

    // Доход
    if (inAmt > 0 && inAcc) {
      rows.push({
        date: dateISO,
        type: 'income',
        amount: inAmt,
        currency: (inCurIdx >= 0 ? cells[inCurIdx] : 'RUB') || 'RUB',
        accountName: inAcc,
        categoryName,
        comment,
      })
      return
    }

    errors.push(`Строка ${lineNo}: не удалось определить тип операции (нет суммы)`)
  })

  return { rows, errors }
}

// Наш формат как раньше
const adaptSavmoney = (headers: string[], dataLines: string[], sep: ';' | ',' | '\t' | '|'): ImportResult => {
  const errors: string[] = []
  const rows: ImportRow[] = []

  dataLines.forEach((line, idx) => {
    const cells = parseCsvLine(line, sep).map((c) => c.trim())
    const lineNo = idx + 2

    if (cells.length < 5) {
      errors.push(`Строка ${lineNo}: недостаточно колонок`)
      return
    }

    const [dateStr, typeStr, amountStr, currencyRaw, accountName, categoryName = '', comment = ''] = cells

    const dateISO = parseAnyDate(dateStr)
    if (!dateISO) {
      errors.push(`Строка ${lineNo}: неверная дата «${dateStr}»`)
      return
    }
    const type = parseType(typeStr)
    if (!type) {
      errors.push(`Строка ${lineNo}: неизвестный тип «${typeStr}»`)
      return
    }
    const parsed = parseAmount(amountStr)
    if (!parsed || parsed.amount <= 0) {
      errors.push(`Строка ${lineNo}: сумма должна быть числом > 0`)
      return
    }
    const currency = (currencyRaw || 'RUB').toUpperCase()
    if (!accountName) {
      errors.push(`Строка ${lineNo}: не указан счёт`)
      return
    }

    rows.push({
      date: dateISO,
      type,
      amount: parsed.amount,
      currency,
      accountName,
      categoryName,
      comment: comment || undefined,
    })
  })

  return { rows, errors }
}

// ============================================================================
// Главный парсер — пробует распознать формат и применяет адаптер
// ============================================================================

export const parseImportCSV = (text: string): ImportResult => {
  // Убираем BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { rows: [], errors: ['Файл пустой'] }
  }

  // Определяем разделитель
  const sep = detectSeparator(lines[0])

  // Есть ли заголовок (первая строка без цифр)
  const hasHeader = !/\d{4}|\d{1,2}[./-]\d{1,2}/.test(lines[0])
  const headers = hasHeader ? parseCsvLine(lines[0], sep).map((h) => h.trim()) : []
  const dataLines = hasHeader ? lines.slice(1) : lines

  // v0.91: детект формата
  const format = hasHeader ? detectFormat(headers) : { key: 'unknown' as FormatKey, name: 'Без заголовка' }

  let result: ImportResult
  switch (format.key) {
    case 'savmoney':
      result = adaptSavmoney(headers, dataLines, sep)
      break
    case 'zenmoney':
      result = adaptZenmoney(headers, dataLines, sep)
      break
    case 'coinkeeper':
    case 'monefy':
    case 'moneymanager':
    case 'moneylover':
    case '1money':
    case 'ynab':
      result = adaptByHeaders(headers, dataLines, sep)
      break
    case 'unknown':
    default:
      // Пробуем универсальный адаптер по заголовкам — вдруг повезёт
      if (hasHeader) {
        result = adaptByHeaders(headers, dataLines, sep)
        if (result.rows.length === 0 && result.errors.length > 0) {
          result.needsAI = true
        }
      } else {
        result = { rows: [], errors: ['Формат не опознан. Попробуй AI-импорт.'], needsAI: true }
      }
      break
  }

  return { ...result, detectedFormat: format.name }
}
