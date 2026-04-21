import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { BackButton } from '@/components/BackButton'
import { exportTransactionsCSV, downloadFile } from '@/lib/csv'
import { haptic } from '@/lib/telegram'

interface Props { onClose: () => void }

type Period = 'month' | '3months' | 'year' | 'all' | 'custom'

interface PeriodOption {
  key: Period
  label: string
  range: () => { from?: Date; to?: Date }
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)

export const ExportScreen: React.FC<Props> = ({ onClose }) => {
  const state = useStore()
  const [period, setPeriod] = useState<Period>('3months')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const options: PeriodOption[] = [
    {
      key: 'month',
      label: 'Текущий месяц',
      range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    },
    {
      key: '3months',
      label: 'Последние 3 месяца',
      range: () => {
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        return { from, to: now }
      },
    },
    {
      key: 'year',
      label: 'Этот год',
      range: () => {
        const y = new Date().getFullYear()
        return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) }
      },
    },
    {
      key: 'all',
      label: 'Вся история',
      range: () => ({}),
    },
  ]

  // Счётчик операций для каждого периода
  const count = (opt: PeriodOption): number => {
    const { from, to } = opt.range()
    return state.transactions.filter((t) => {
      const d = new Date(t.date).getTime()
      if (from && d < from.getTime()) return false
      if (to && d > to.getTime()) return false
      return true
    }).length
  }

  const counts = useMemo(() => ({
    month: count(options[0]),
    '3months': count(options[1]),
    year: count(options[2]),
    all: count(options[3]),
  }), [state.transactions])

  const customRange = (): { from?: Date; to?: Date } => {
    const f = customFrom ? new Date(customFrom) : undefined
    const t = customTo ? new Date(customTo + 'T23:59:59') : undefined
    return { from: f, to: t }
  }

  const customCount = useMemo(() => {
    if (period !== 'custom') return 0
    const { from, to } = customRange()
    if (!from && !to) return state.transactions.length
    return state.transactions.filter((t) => {
      const d = new Date(t.date).getTime()
      if (from && d < from.getTime()) return false
      if (to && d > to.getTime()) return false
      return true
    }).length
  }, [customFrom, customTo, period, state.transactions])

  const [busy, setBusy] = useState(false)
  const handleDownload = async () => {
    if (busy) return
    const opt = options.find((o) => o.key === period)
    const { from, to } = period === 'custom' ? customRange() : (opt ? opt.range() : {})
    const csv = exportTransactionsCSV(state, from, to)
    if (!csv) {
      haptic.error()
      alert('Нет операций за выбранный период.')
      return
    }
    setBusy(true)
    haptic.light()
    const now = new Date().toISOString().slice(0, 10)
    const result = await downloadFile(`sohranenki_${period}_${now}.csv`, csv)
    setBusy(false)
    if (result === 'error') {
      haptic.error()
      alert('Не удалось выгрузить файл.')
    } else {
      haptic.success()
      onClose()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
        <BackButton onClick={onClose} />
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Экспорт</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="px-4 pb-6">
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 22, marginTop: 8 }}>
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: 72, height: 72,
              marginBottom: 14,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #141414, #0a0a0a)',
              border: '0.5px solid #222',
              fontSize: 30,
              boxShadow: '0 0 30px rgba(255,23,68,0.15)',
            }}
          >
            📊
          </div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
            Выгрузка в CSV
          </div>
          <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5, padding: '0 20px' }}>
            Скачай историю расходов — откроется в Excel, Numbers или Google Sheets
          </div>
        </div>

        {/* Период */}
        <div
          style={{
            color: '#555', fontSize: 10, letterSpacing: '1.3px',
            fontWeight: 500, textTransform: 'uppercase', marginBottom: 6,
          }}
        >
          Период
        </div>
        <div className="flex flex-col" style={{ gap: 5, marginBottom: 14 }}>
          {options.map((opt) => {
            const active = period === opt.key
            const n = counts[opt.key as keyof typeof counts]
            return (
              <button
                key={opt.key}
                onClick={() => { haptic.select(); setPeriod(opt.key) }}
                className="flex items-center justify-between text-left cursor-pointer border-0 w-full"
                style={{
                  padding: '12px 14px',
                  background: active ? 'rgba(255,23,68,0.06)' : '#141414',
                  border: active ? '1px solid #ff1744' : '0.5px solid #222',
                  borderRadius: 12,
                  gap: 10,
                }}
              >
                <div style={{
                  color: '#fff', fontSize: 13,
                  fontWeight: active ? 500 : 400,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  color: active ? '#ff1744' : '#666',
                  fontSize: 11, fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {n.toLocaleString('ru-RU')} {pluralize(n, ['операция', 'операции', 'операций'])}
                  {active && ' ✓'}
                </div>
              </button>
            )
          })}
          <button
            onClick={() => { haptic.select(); setPeriod('custom') }}
            className="flex items-center justify-between text-left cursor-pointer border-0 w-full"
            style={{
              padding: '12px 14px',
              background: period === 'custom' ? 'rgba(255,23,68,0.06)' : '#141414',
              border: period === 'custom' ? '1px solid #ff1744' : '0.5px solid #222',
              borderRadius: 12,
            }}
          >
            <div style={{
              color: period === 'custom' ? '#fff' : '#aaa',
              fontSize: 13,
              fontWeight: period === 'custom' ? 500 : 400,
            }}>
              Произвольный период
            </div>
            <span style={{ color: '#555', fontSize: 16 }}>›</span>
          </button>
          {period === 'custom' && (
            <div style={{
              padding: 12, background: '#0f0f0f', borderRadius: 12, border: '0.5px solid #222',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <label style={{ color: '#888', fontSize: 11, width: 40 }}>С:</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="flex-1"
                  style={{
                    padding: '8px 10px', background: '#1a1a1a', border: '0.5px solid #333',
                    borderRadius: 8, color: '#fff', fontSize: 13,
                  }}
                />
              </div>
              <div className="flex items-center" style={{ gap: 8 }}>
                <label style={{ color: '#888', fontSize: 11, width: 40 }}>По:</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="flex-1"
                  style={{
                    padding: '8px 10px', background: '#1a1a1a', border: '0.5px solid #333',
                    borderRadius: 8, color: '#fff', fontSize: 13,
                  }}
                />
              </div>
              <div style={{ color: '#ff1744', fontSize: 11, fontWeight: 600 }}>
                {customCount.toLocaleString('ru-RU')} {pluralize(customCount, ['операция', 'операции', 'операций'])}
              </div>
            </div>
          )}
        </div>

        {/* Формат */}
        <div
          style={{
            color: '#555', fontSize: 10, letterSpacing: '1.3px',
            fontWeight: 500, textTransform: 'uppercase', marginBottom: 6,
          }}
        >
          Формат
        </div>
        <div
          style={{
            padding: 14, background: '#141414',
            border: '0.5px solid #222', borderRadius: 14, marginBottom: 10,
          }}
        >
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 32, height: 32,
                borderRadius: 8,
                background: 'rgba(74,222,128,0.1)',
                color: '#4ade80',
                fontSize: 12, fontWeight: 700,
                fontFamily: '"SF Mono", ui-monospace, monospace',
              }}
            >
              csv
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>CSV с разделителем «;»</div>
              <div style={{ color: '#666', fontSize: 10, marginTop: 1 }}>UTF-8 BOM · для Excel RU</div>
            </div>
          </div>
          <div
            style={{
              fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
              color: '#666', padding: '8px 10px',
              background: '#0a0a0a', borderRadius: 8, lineHeight: 1.5,
              overflow: 'hidden',
            }}
          >
            Дата;Тип;Сумма;Валюта;Счёт;Категория<br/>
            2026-04-19 12:00;Расход;500;RUB;Тинькофф;Еда<br/>
            2026-04-19 18:00;Доход;100000;RUB;Тинькофф;…
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex" style={{ gap: 8, marginTop: 18 }}>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 cursor-pointer flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            style={{
              padding: 13,
              background: 'transparent',
              border: '0.5px solid #333',
              borderRadius: 14,
              color: '#fff',
              fontSize: 13,
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Скачать
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 cursor-pointer flex items-center justify-center active:scale-95 transition-transform border-0 disabled:opacity-50"
            style={{
              padding: 13,
              background: '#ff1744',
              borderRadius: 14,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(255,23,68,0.4)',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Поделиться
          </button>
        </div>
      </div>
    </div>
  )
}

const pluralize = (n: number, forms: [string, string, string]): string => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}
