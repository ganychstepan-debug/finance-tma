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
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Все операции</div>
        <div className="w-12" />
      </div>

      {/* Фильтры */}
      <div className="px-5 pb-2 space-y-2">
        <div className="flex gap-1.5 scroll-x overflow-x-auto">
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
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border-0 ${
                period === p.id ? 'bg-accent text-white' : 'bg-bg-secondary text-text-muted border border-border'
              }`}
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
              className={`flex-1 py-1.5 rounded text-xs font-medium cursor-pointer border-0 ${
                filterType === t.id ? 'bg-bg-tertiary text-white' : 'bg-transparent text-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по категории, счёту, комментарию"
          className="w-full px-3.5 py-2.5 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
        />
      </div>

      {/* Итоги */}
      {totals.count > 0 && (
        <div className="px-5 py-3 border-y border-border-muted flex justify-between items-center bg-bg-secondary/30">
          <div>
            <div className="text-2xs text-text-muted uppercase tracking-wide">Итого</div>
            <div className={`text-base font-medium ${totals.delta >= 0 ? 'text-success' : 'text-accent'}`}>
              {totals.delta >= 0 ? '+' : '−'}{Math.abs(Math.round(totals.delta)).toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-success">+{Math.round(totals.income).toLocaleString('ru-RU')} ₽</div>
            <div className="text-xs text-accent">−{Math.round(totals.expense).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      )}

      {/* Список */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {groups.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-text-muted">
              {state.transactions.length === 0 ? 'Нет операций' : 'Ничего не найдено'}
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="mb-4">
              <div className="flex justify-between items-baseline mb-1.5 px-0.5">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wide">
                  {formatDayHeading(g.date)}
                </div>
                <div className="text-2xs text-text-muted">
                  {g.expense > 0 && <span className="text-accent">−{Math.round(g.expense).toLocaleString('ru-RU')} ₽</span>}
                  {g.income > 0 && g.expense > 0 && <span className="mx-1">·</span>}
                  {g.income > 0 && <span className="text-success">+{Math.round(g.income).toLocaleString('ru-RU')} ₽</span>}
                </div>
              </div>
              <div className="bg-bg-secondary rounded-card border border-border-muted overflow-hidden">
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
          ))
        )}
      </div>
    </div>
  )
}
