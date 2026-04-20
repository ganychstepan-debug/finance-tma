import { useState, useMemo } from 'react'
import { useStore, selectMonthTransactions, selectMonthSpend } from '@/store'
import { haptic } from '@/lib/telegram'
import { convert } from '@/lib/fx'
import { formatMonth } from '@/lib/formatters'

type Period = 'week' | 'month' | 'year'

// v0.29: Палитра «киберпанк» для долей диаграммы
const RED_SHADES = ['#ff1744', '#ff4d8f', '#a855f7', '#3b82f6', '#06b6d4']

export const StatsScreen: React.FC = () => {
  const state = useStore()
  const [period, setPeriod] = useState<Period>('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const baseCurrency = state.settings.baseCurrency

  const y = selectedMonth.getFullYear()
  const m = selectedMonth.getMonth()

  const prevMonth = () => {
    haptic.select()
    setSelectedMonth(new Date(y, m - 1, 1))
  }
  const nextMonth = () => {
    haptic.select()
    setSelectedMonth(new Date(y, m + 1, 1))
  }

  // Период зависит от таба. Для беты: неделя = последние 7 дней, месяц/год — календарные.
  const periodTxs = useMemo(() => {
    if (period === 'month') return selectMonthTransactions(state, y, m)
    if (period === 'year') {
      return state.transactions.filter((t) => new Date(t.date).getFullYear() === y)
    }
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return state.transactions.filter((t) => new Date(t.date).getTime() >= weekAgo)
  }, [state.transactions, period, y, m])

  const expenseTxs = periodTxs.filter((t) => t.type === 'expense')
  // Суммы конвертируем в базовую валюту
  const totalSpend = expenseTxs.reduce((sum, t) => sum + convert(t.amount, t.currency, baseCurrency), 0)

  // Группируем по категориям (тоже в базовой валюте)
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of expenseTxs) {
      const key = t.categoryId ?? 'other'
      const amount = convert(t.amount, t.currency, baseCurrency)
      map.set(key, (map.get(key) ?? 0) + amount)
    }
    const entries = Array.from(map.entries())
      .map(([id, amount]) => {
        const category = state.categories.find((c) => c.id === id)
        return {
          id,
          name: category?.name ?? 'Без категории',
          amount,
          percent: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // Топ-4 + остальное
    if (entries.length <= 5) return entries
    const top = entries.slice(0, 4)
    const rest = entries.slice(4)
    const restSum = rest.reduce((s, e) => s + e.amount, 0)
    return [
      ...top,
      {
        id: '__other__',
        name: 'Прочее',
        amount: restSum,
        percent: totalSpend > 0 ? Math.round((restSum / totalSpend) * 100) : 0,
      },
    ]
  }, [expenseTxs, state.categories, totalSpend])

  // Сравнение с прошлым месяцем
  const prevMonthSpend = selectMonthSpend(
    state,
    m === 0 ? y - 1 : y,
    m === 0 ? 11 : m - 1,
  )
  const diffPct = prevMonthSpend > 0
    ? Math.round(((totalSpend - prevMonthSpend) / prevMonthSpend) * 100)
    : 0

  // Дни в периоде для среднего
  const daysInPeriod = period === 'week' ? 7 : period === 'year' ? 365 : new Date(y, m + 1, 0).getDate()
  const avgPerDay = totalSpend / daysInPeriod

  // Построение дуг круга
  const RADIUS = 76
  const STROKE = 18
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  let offsetAcc = 0
  const arcs = byCategory.map((c, i) => {
    const length = (c.percent / 100) * CIRCUMFERENCE
    const arc = {
      length,
      offset: -offsetAcc,
      color: RED_SHADES[i] ?? RED_SHADES[RED_SHADES.length - 1],
    }
    offsetAcc += length
    return arc
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-4">
      <div className="px-5 pt-3 pb-3 flex justify-between items-center">
        <div className="text-xl font-medium">Статистика</div>
        {period === 'month' && (
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-full bg-bg-secondary border-0 cursor-pointer text-text-secondary flex items-center justify-center"
              aria-label="Прошлый месяц"
            >
              ‹
            </button>
            <div className="text-xs text-text-secondary uppercase tracking-wide min-w-[90px] text-center font-medium">
              {formatMonth(selectedMonth)}
            </div>
            <button
              onClick={nextMonth}
              disabled={y === new Date().getFullYear() && m === new Date().getMonth()}
              className="w-8 h-8 rounded-full bg-bg-secondary border-0 cursor-pointer text-text-secondary flex items-center justify-center disabled:opacity-30"
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="px-5 mb-4 flex gap-1.5">
        {(['week', 'month', 'year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { haptic.select(); setPeriod(p) }}
            className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border ${
              period === p ? 'bg-accent border-0 text-white' : 'bg-bg-secondary border-border text-text-muted'
            }`}
          >
            {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
          </button>
        ))}
      </div>

      {totalSpend === 0 ? (
        <div className="flex-1 flex items-center justify-center px-5 py-12 text-center">
          <div>
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm text-text-secondary">
              Нет данных за этот период
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Круговая диаграмма */}
          <div className="px-5 mb-5 flex justify-center">
            <div className="relative w-[200px] h-[200px]">
              <svg viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="#1a1a1a" strokeWidth={STROKE} />
                {arcs.map((a, i) => (
                  <circle
                    key={i}
                    cx="100"
                    cy="100"
                    r={RADIUS}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${a.length} ${CIRCUMFERENCE}`}
                    strokeDashoffset={a.offset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-2xs text-text-muted uppercase tracking-wide">Расходы</div>
                <div className="text-[22px] font-medium mt-0.5">
                  {Math.round(totalSpend).toLocaleString('ru-RU')}
                </div>
                <div className="text-xs text-text-muted">
                  ₽ за {period === 'week' ? 'неделю' : period === 'month' ? 'месяц' : 'год'}
                </div>
              </div>
            </div>
          </div>

          {/* Список */}
          <div className="px-5 mb-5">
            {byCategory.map((c, i) => (
              <div
                key={c.id}
                className="flex justify-between items-center py-2.5 border-b border-border-muted"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: RED_SHADES[i] ?? RED_SHADES[RED_SHADES.length - 1] }}
                  />
                  <span className={`text-sm ${c.id === '__other__' ? 'text-text-secondary' : ''}`}>
                    {c.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {Math.round(c.amount).toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-xs text-text-muted min-w-9 text-right">{c.percent}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Сводка */}
          <div className="px-5">
            <div className="p-3.5 bg-bg-secondary border border-border rounded-card flex justify-between items-center">
              <div>
                <div className="text-2xs text-text-muted uppercase tracking-wide">Средний расход</div>
                <div className="text-base font-medium mt-0.5">
                  {Math.round(avgPerDay).toLocaleString('ru-RU')} ₽ / день
                </div>
              </div>
              {period === 'month' && prevMonthSpend > 0 && (
                <div className="text-right">
                  <div className="text-xs text-text-muted">vs прошлый месяц</div>
                  <div className={`text-sm font-medium ${diffPct <= 0 ? 'text-success' : 'text-accent'}`}>
                    {diffPct <= 0 ? '▼' : '▲'} {diffPct > 0 ? '+' : ''}{diffPct}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
