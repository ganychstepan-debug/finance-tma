import { useMemo, useRef, useState } from 'react'
import { useStore } from '@/store'
import { BackButton } from '@/components/BackButton'
import { parseImportCSV, type ImportRow, emptyTemplateCSV, downloadFile } from '@/lib/csv'
import { haptic } from '@/lib/telegram'

interface Props { onClose: () => void }

export const ImportScreen: React.FC<Props> = ({ onClose }) => {
  const state = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    haptic.light()
    setFileName(file.name)

    try {
      const text = await file.text()
      const result = parseImportCSV(text)
      setRows(result.rows)
      setErrors(result.errors)
      if (result.rows.length === 0 && result.errors.length === 0) {
        setErrors(['Файл пустой или формат не опознан'])
      }
    } catch (err) {
      setErrors([`Не удалось прочитать файл: ${(err as Error).message}`])
    }
  }

  const totalLines = (rows?.length ?? 0) + errors.length

  const preview = useMemo(() => {
    if (!rows) return []
    return rows.slice(0, 3)
  }, [rows])

  const handleDownloadTemplate = async () => {
    haptic.light()
    const csv = emptyTemplateCSV()
    await downloadFile('sohranenki_template.csv', csv)
  }

  const handleImport = async () => {
    if (!rows || rows.length === 0 || busy) return
    setBusy(true)
    haptic.medium()
    try {
      // Собираем список имён существующих счетов/категорий для матчинга
      const accByName = new Map(
        state.accounts.map((a) => [a.name.toLowerCase().trim(), a])
      )
      const catByName = new Map(
        state.categories.map((c) => [`${c.type}:${c.name.toLowerCase().trim()}`, c])
      )

      let addedTx = 0
      let createdAccounts = 0
      let createdCategories = 0

      for (const row of rows) {
        // Найти или создать счёт
        const accKey = row.accountName.toLowerCase().trim()
        let acc = accByName.get(accKey)
        if (!acc) {
          acc = state.addAccount({
            name: row.accountName,
            type: 'card',
            balance: 0,
            currency: row.currency as any,
            icon: 'other',
            includeInTotal: true,
            archived: false,
          })
          accByName.set(accKey, acc)
          createdAccounts++
        }

        // Для transfer — категория не нужна
        let categoryId: string | undefined
        if (row.type !== 'transfer' && row.categoryName) {
          const catKey = `${row.type}:${row.categoryName.toLowerCase().trim()}`
          let cat = catByName.get(catKey)
          if (!cat) {
            cat = state.addCategory({
              name: row.categoryName,
              type: row.type as 'expense' | 'income',
              icon: 'other',
              color: '#ff1744',
              budgetMonthly: null,
              isCustom: true,
              archived: false,
              sortOrder: 999,
            })
            catByName.set(catKey, cat)
            createdCategories++
          }
          categoryId = cat.id
        }

        // Для переводов второй счёт пока не обрабатываем (минимум полей в CSV)
        if (row.type === 'transfer') continue

        state.addTransaction({
          type: row.type as 'expense' | 'income',
          amount: row.amount,
          currency: row.currency as any,
          accountId: acc.id,
          categoryId: categoryId!,
          date: row.date,
          comment: row.comment,
        })
        addedTx++
      }

      haptic.success()
      alert(
        `Готово!\n\n` +
        `Добавлено операций: ${addedTx}\n` +
        (createdAccounts > 0 ? `Создано счетов: ${createdAccounts}\n` : '') +
        (createdCategories > 0 ? `Создано категорий: ${createdCategories}` : '')
      )
      onClose()
    } catch (e) {
      haptic.error()
      alert(`Ошибка импорта: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
        <BackButton onClick={onClose} />
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Импорт CSV</div>
        <div style={{ width: 60 }} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={handlePick}
        className="hidden"
      />

      <div className="px-4 pb-6">
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 18, marginTop: 8 }}>
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: 64, height: 64,
              marginBottom: 12,
              borderRadius: 16,
              background: '#141414',
              border: '0.5px solid #222',
              fontSize: 28,
            }}
          >
            📥
          </div>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 500, marginBottom: 3 }}>
            Загрузить историю
          </div>
          <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5, padding: '0 16px' }}>
            CSV из другого трекера или из Сохранёнок
          </div>
        </div>

        {/* Drop area */}
        <button
          onClick={() => { haptic.light(); fileInputRef.current?.click() }}
          className="w-full cursor-pointer border-0 active:scale-[0.99] transition-transform"
          style={{
            padding: '28px 20px',
            background: 'rgba(255,23,68,0.03)',
            border: '1.5px dashed rgba(255,23,68,0.4)',
            borderRadius: 16,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: 48, height: 48,
              marginBottom: 12,
              borderRadius: '50%',
              background: 'rgba(255,23,68,0.08)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff1744" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            {fileName ? fileName : 'Выбери CSV-файл'}
          </div>
          <div style={{ color: '#666', fontSize: 11 }}>
            {rows ? 'Нажми чтобы выбрать другой' : 'или перетащи сюда'}
          </div>
        </button>

        {/* Превью */}
        {rows && preview.length > 0 && (
          <>
            <div
              style={{
                color: '#555', fontSize: 10, letterSpacing: '1.3px',
                fontWeight: 500, textTransform: 'uppercase', marginBottom: 6,
              }}
            >
              Превью · первые 3 строки
            </div>
            <div
              style={{
                padding: 10,
                background: '#141414',
                border: '0.5px solid rgba(74,222,128,0.2)',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
                  color: '#aaa', lineHeight: 1.7,
                  overflowX: 'auto', whiteSpace: 'nowrap',
                }}
              >
                <div style={{ color: '#666', borderBottom: '0.5px solid #222', paddingBottom: 3, marginBottom: 3 }}>
                  Дата · Тип · Сумма · Валюта · Счёт · Категория
                </div>
                {preview.map((r, i) => {
                  const typeLabel = r.type === 'expense' ? 'Расход' : r.type === 'income' ? 'Доход' : 'Перевод'
                  const typeColor = r.type === 'expense' ? '#ff6b7a' : r.type === 'income' ? '#4ade80' : '#aaa'
                  const date = r.date.replace('T', ' ').slice(0, 16)
                  return (
                    <div key={i}>
                      <span style={{ color: '#ddd' }}>{date}</span>
                      {' · '}
                      <span style={{ color: typeColor }}>{typeLabel}</span>
                      {' · '}{r.amount}{' · '}{r.currency}{' · '}{r.accountName}{' · '}{r.categoryName || '—'}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Статистика */}
        {rows && (
          <div className="flex" style={{ gap: 6, marginBottom: 14 }}>
            <div
              className="flex-1 text-center"
              style={{
                padding: 10,
                background: '#141414', border: '0.5px solid #222',
                borderRadius: 10,
              }}
            >
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
                {totalLines}
              </div>
              <div style={{ color: '#666', fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 2 }}>
                строк
              </div>
            </div>
            <div
              className="flex-1 text-center"
              style={{
                padding: 10,
                background: 'rgba(74,222,128,0.05)',
                border: '0.5px solid rgba(74,222,128,0.2)',
                borderRadius: 10,
              }}
            >
              <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 600 }}>
                {rows.length}
              </div>
              <div style={{ color: '#4ade80', fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 2, opacity: 0.7 }}>
                ок
              </div>
            </div>
            <div
              className="flex-1 text-center"
              style={{
                padding: 10,
                background: 'rgba(255,23,68,0.05)',
                border: '0.5px solid rgba(255,23,68,0.2)',
                borderRadius: 10,
              }}
            >
              <div style={{ color: '#ff1744', fontSize: 18, fontWeight: 600 }}>
                {errors.length}
              </div>
              <div style={{ color: '#ff1744', fontSize: 9, letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 2, opacity: 0.8 }}>
                ошибок
              </div>
            </div>
          </div>
        )}

        {/* v0.75: 5.07 Карточка-сводка ошибок — появляется если есть и успешные строки и ошибки */}
        {rows && rows.length > 0 && errors.length > 0 && (
          <div
            style={{
              padding: 16,
              background: 'linear-gradient(135deg, rgba(255,23,68,0.08), rgba(255,23,68,0.02))',
              border: '0.5px solid rgba(255,23,68,0.3)',
              borderRadius: 16,
              marginBottom: 14,
            }}
          >
            <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff1744" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
                  Нашли {errors.length} {pluralizeErrors(errors.length)}
                </div>
                <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>
                  {rows.length} {pluralizeRows(rows.length)} пройдут, {errors.length} пропустим
                </div>
              </div>
            </div>
          </div>
        )}

        {/* v0.75: Структурированный список ошибок с парсингом */}
        {errors.length > 0 && (
          <>
            <div
              style={{
                color: '#555', fontSize: 10, letterSpacing: '1.3px',
                fontWeight: 500, textTransform: 'uppercase', marginBottom: 6,
              }}
            >
              Список ошибок
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 280, overflowY: 'auto' }}>
              {errors.slice(0, 30).map((err, i) => {
                const parsed = parseErrorMessage(err)
                return (
                  <div
                    key={i}
                    style={{
                      padding: '11px 13px',
                      background: '#141414',
                      border: '0.5px solid rgba(255,23,68,0.2)',
                      borderLeft: '2px solid #ff1744',
                      borderRadius: 10,
                    }}
                  >
                    <div className="flex items-baseline" style={{ gap: 8, marginBottom: 3 }}>
                      {parsed.line != null && (
                        <span style={{
                          color: '#ff1744', fontSize: 10, fontWeight: 700,
                          fontFamily: '"SF Mono", ui-monospace, monospace',
                        }}>
                          СТР. {parsed.line}
                        </span>
                      )}
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>
                        {parsed.title}
                      </span>
                    </div>
                    {parsed.detail && (
                      <div style={{ color: '#aaa', fontSize: 10, lineHeight: 1.4 }}>
                        {parsed.detail}
                      </div>
                    )}
                  </div>
                )
              })}
              {errors.length > 30 && (
                <div style={{ color: '#666', fontSize: 10, textAlign: 'center', paddingTop: 4 }}>
                  и ещё {errors.length - 30}…
                </div>
              )}
            </div>

            {/* v0.75: Совет что можно пропустить плохие строки */}
            {rows && rows.length > 0 && (
              <div
                className="flex items-start"
                style={{
                  padding: '12px 14px',
                  background: 'rgba(74,222,128,0.05)',
                  border: '0.5px solid rgba(74,222,128,0.2)',
                  borderRadius: 12,
                  marginBottom: 14,
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 14, marginTop: 1 }}>💡</span>
                <div style={{ color: '#aaa', fontSize: 11, lineHeight: 1.5 }}>
                  Можно пропустить ошибочные строки и импортировать только валидные — <span style={{ color: '#4ade80', fontWeight: 500 }}>{rows.length} {pluralizeOperations(rows.length)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Шаблон */}
        <button
          onClick={handleDownloadTemplate}
          className="w-full flex items-center text-left cursor-pointer border-0"
          style={{
            padding: '10px 12px',
            background: '#141414',
            border: '0.5px solid #222',
            borderRadius: 12,
            marginBottom: 16,
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff1744" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Скачать шаблон</div>
            <div style={{ color: '#666', fontSize: 10, marginTop: 1 }}>Пример формата на 3 строки</div>
          </div>
          <span style={{ color: '#ff1744', fontSize: 11, fontWeight: 500 }}>Скачать</span>
        </button>

        {/* Buttons */}
        <div className="flex" style={{ gap: 8 }}>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{
              flex: 1, padding: 13,
              background: 'transparent',
              border: '0.5px solid #333',
              borderRadius: 14,
              color: '#aaa',
              fontSize: 13,
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={!rows || rows.length === 0 || busy}
            className="cursor-pointer border-0 disabled:opacity-40"
            style={{
              flex: 2, padding: 13,
              background: '#ff1744',
              borderRadius: 14,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: rows && rows.length > 0 ? '0 4px 20px rgba(255,23,68,0.4)' : 'none',
            }}
          >
            {busy ? 'Импорт…' : rows ? `Импортировать ${rows.length}` : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  )
}

// v0.75: Парсер строк ошибок из lib/csv.ts в структуру
// Примеры формата:
//   "Строка 3: неверная дата «19.04.26». Формат: YYYY-MM-DD или YYYY-MM-DD HH:MM"
//   "Строка 17: неизвестный тип «Покупка». Нужно: Расход, Доход или Перевод"
//   "Строка 32: не указан счёт"
//   "Файл пустой"
interface ParsedError {
  line: number | null
  title: string
  detail: string | null
}

const parseErrorMessage = (raw: string): ParsedError => {
  // Пытаемся извлечь номер строки
  const match = raw.match(/^Строка (\d+):\s*(.+)$/)
  if (!match) {
    return { line: null, title: raw, detail: null }
  }
  const line = Number(match[1])
  const rest = match[2]

  // Пытаемся разделить заголовок и детали по первой точке или по тире
  // Типовые варианты в csv.ts: "неверная дата «X». Формат: Y"
  const dotIdx = rest.indexOf('. ')
  if (dotIdx > 0) {
    const title = capitalize(rest.slice(0, dotIdx))
    const detail = rest.slice(dotIdx + 2)
    return { line, title, detail }
  }

  return { line, title: capitalize(rest), detail: null }
}

const capitalize = (s: string): string =>
  s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s

const pluralizeErrors = (n: number): string => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'ошибку'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ошибки'
  return 'ошибок'
}

const pluralizeRows = (n: number): string => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'строка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'строки'
  return 'строк'
}

const pluralizeOperations = (n: number): string => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'операцию'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'операции'
  return 'операций'
}
