import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { TransactionRow } from '@/components/TransactionRow'
import { SwipeableRow } from '@/components/SwipeableRow'
import { haptic } from '@/lib/telegram'
import type { Transaction } from '@/types'
import { BackButton } from '@/components/BackButton'

interface Props {
  onClose: () => void
  onEditTransaction: (id: string) => void
}

type Period = 'week' | 'month' | '3months' | 'year' | 'all'

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const formatDayHeading = (iso: string): string => {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0,0,0,0)
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  const dNorm = new Date(d)
  dNorm.setHours(0,0,0,0)

  if (dNorm.getTime() === today.getTime()) return 'Сегодня'
  if (dNorm.getTime() === yest.getTime()) return 'Вчера'

  const sameYear = d.getFullYear() === today.getFullYear()
  const dow = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()]
  return sameYear
    ? `${d.getDate()} ${MONTHS[d.getMonth()]} · ${dow}`
    : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const dayKey = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export const AllTransactionsScreen: React.FC<Props> = ({ onClose, onEditTransaction }) => {
  const state = useStore()
  const [period, setPeriod] = useState<Period>('month')
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')
  const [search, setSearch] = useState('')

  // Диапазон дат для периода
  const fromTime = useMemo(() => {
    if (period === 'all') return -Infinity
    const d = new Date()
    if (period === 'week') d.setDate(d.getDate() - 7)
    else if (period === 'month') d.setMonth(d.getMonth() - 1)
    else if (period === '3months') d.setMonth(d.getMonth() - 3)
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [period])

  // Фильтрация
  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    return state.transactions.filter((t) => {
      const ts = new Date(t.date).getTime()
      if (ts < fromTime) return false
      if (filterType !== 'all' && t.type !== filterType) return false
      if (searchLower) {
        const cat = state.categories.find((c) => c.id === t.categoryId)?.name.toLowerCase() ?? ''
        const acc = state.accounts.find((a) => a.id === t.accountId)?.name.toLowerCase() ?? ''
        const comment = (t.comment ?? '').toLowerCase()
        if (!cat.includes(searchLower) && !acc.includes(searchLower) && !comment.includes(searchLower)) {
          return false
        }
      }
      return true
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [state.transactions, state.categories, state.accounts, fromTime, filterType, search])

  // Группировка по дням
  const groups = useMemo(() => {
    const map = new Map<string, { date: string; items: Transaction[]; income: number; expense: number }>()
    for (const tx of filtered) {
      const key = dayKey(tx.date)
      if (!map.has(key)) {
        map.set(key, { date: tx.date, items: [], income: 0, expense: 0 })
      }
      const g = map.get(key)!
      g.items.push(tx)
      if (tx.type === 'income') g.income += tx.amount
      else if (tx.type === 'expense') g.expense += tx.amount
    }
    return Array.from(map.values())
  }, [filtered])

  // Итоги за период
  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of filtered) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
    }
    return { income, expense, delta: income - expense, count: filtered.length }
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-4 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Все операции</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Фильтры */}
      <div className="px-4 pb-2 space-y-2">
        <div className="flex gap-1.5 scroll-x overflow-x-auto" style={{ paddingBottom: 2 }}>
          {[
            { id: 'week' as const,     label: 'Неделя' },
            { id: 'month' as const,    label: 'Месяц' },
            { id: '3months' as const,  label: '3 мес.' },
            { id: 'year' as const,     label: 'Год' },
            { id: 'all' as const,      label: 'Всё' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => { haptic.select(); setPeriod(p.id) }}
              className="shrink-0 cursor-pointer"
              style={{
                padding: '6px 12px',
                background: period === p.id ? '#ff1744' : '#141414',
                border: period === p.id ? '0' : '0.5px solid #222',
                borderRadius: 999,
                color: period === p.id ? '#fff' : '#888',
                fontSize: 11,
                fontWeight: period === p.id ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[
            { id: 'all' as const,     label: 'Все' },
            { id: 'expense' as const, label: 'Расходы' },
            { id: 'income' as const,  label: 'Доходы' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { haptic.select(); setFilterType(t.id) }}
              className="flex-1 cursor-pointer border-0"
              style={{
                padding: '7px 0',
                background: filterType === t.id ? '#1f1f1f' : 'transparent',
                borderRadius: 8,
                color: filterType === t.id ? '#fff' : '#888',
                fontSize: 11,
                fontWeight: filterType === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="flex items-center"
          style={{
            padding: '9px 13px',
            background: '#141414',
            border: '0.5px solid #222',
            borderRadius: 10,
            gap: 8,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по категории, счёту, комментарию"
            className="flex-1 bg-transparent border-0 text-white outline-none p-0"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Итоги */}
      {totals.count > 0 && (
        <div
          className="flex justify-between items-center"
          style={{
            margin: '0 -16px',
            padding: '10px 20px',
            background: 'rgba(20,20,20,0.4)',
            borderTop: '0.5px solid #1a1a1a',
            borderBottom: '0.5px solid #1a1a1a',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ color: '#666', fontSize: 9, letterSpacing: '1px', fontWeight: 500 }}>ИТОГО</div>
            <div style={{
              color: totals.delta >= 0 ? '#00c864' : '#ff1744',
              fontSize: 15,
              fontWeight: 600,
              marginTop: 1,
            }}>
              {totals.delta >= 0 ? '+' : '−'}{Math.abs(Math.round(totals.delta)).toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {totals.income > 0 && (
              <div style={{ color: '#00c864', fontSize: 11 }}>
                +{Math.round(totals.income).toLocaleString('ru-RU')} ₽
              </div>
            )}
            {totals.expense > 0 && (
              <div style={{ color: '#ff1744', fontSize: 11, marginTop: 1 }}>
                −{Math.round(totals.expense).toLocaleString('ru-RU')} ₽
              </div>
            )}
          </div>
        </div>
      )}

      {/* Список */}
      <div className="flex-1 overflow-y-auto px-4 py-1">
        {groups.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-text-muted">
              {state.transactions.length === 0 ? 'Нет операций' : 'Ничего не найдено'}
            </div>
          </div>
        ) : (
          groups.map((g) => {
            const dayDelta = g.income - g.expense
            const hasExpense = g.expense > 0 && g.income === 0
            return (
              <div key={g.date} className="mb-3">
                <div className="flex justify-between items-baseline mb-1.5" style={{ padding: '0 2px' }}>
                  <span style={{
                    color: '#888', fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '1px',
                  }}>
                    {formatDayHeading(g.date)}
                  </span>
                  <span style={{
                    color: hasExpense || dayDelta < 0 ? '#ff1744' : '#00c864',
                    fontSize: 10,
                  }}>
                    {hasExpense || dayDelta < 0 ? '−' : '+'}
                    {Math.abs(Math.round(dayDelta)).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div
                  style={{
                    background: '#141414',
                    border: '0.5px solid #1a1a1a',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {g.items.map((tx, i) => (
                    <SwipeableRow
                      key={tx.id}
                      onDelete={() => state.deleteTransaction(tx.id)}
                    >
                      <div className="px-3">
                        <TransactionRow
                          tx={tx}
                          showDivider={i < g.items.length - 1}
                          onClick={() => onEditTransaction(tx.id)}
                        />
                      </div>
                    </SwipeableRow>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/* v0.34: подсказка про свайп */}
        {filtered.length > 0 && (
          <div
            className="mx-4 mb-6"
            style={{
              marginTop: 20,
              padding: '12px 14px',
              background: 'rgba(255,23,68,0.06)',
              border: '0.5px solid rgba(255,23,68,0.3)',
              borderRadius: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 16 }}>👈</span>
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Свайп влево</div>
              <div style={{ color: '#888', fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>
                Потяни строку влево — появится «Удалить». Потяни дальше — сразу подтверждение.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
