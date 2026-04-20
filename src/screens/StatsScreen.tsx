import { useState, useMemo } from 'react'
import { useStore, selectMonthTransactions, selectMonthSpend } from '@/store'
import { haptic } from '@/lib/telegram'
import { convert } from '@/lib/fx'
import { formatMonth } from '@/lib/formatters'

type Period = 'week' | 'month' | 'year'
type ViewMode = 'expense' | 'income' | 'balance'

// v0.29: Палитра «киберпанк» для долей диаграммы
const RED_SHADES = ['#ff1744', '#ff4d8f', '#a855f7', '#3b82f6', '#06b6d4']

export const StatsScreen: React.FC = () => {
  const state = useStore()
  const [period] = useState<Period>('month')
  // viewMode пока влияет только на UI, расчёт остаётся по расходам; будет расширено
  const [viewMode, setViewMode] = useState<ViewMode>('expense')
  void viewMode
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
        <div style={{ width: 30 }}></div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Статистика</div>
        <button
          className="cursor-pointer flex items-center justify-center"
          style={{
            padding: 7, background: '#141414', border: '0.5px solid #222',
            borderRadius: 10, color: '#ff1744', width: 30, height: 30,
          }}
          aria-label="Экспорт"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </button>
      </div>

      {/* v0.34: селектор месяца под шапкой */}
      <div className="flex items-center justify-center gap-3.5 mb-3.5">
        <button onClick={prevMonth} className="bg-transparent border-0 cursor-pointer" style={{ color: '#555' }}>‹</button>
        <div className="text-center">
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{formatMonth(selectedMonth)}</div>
          <div style={{ color: '#666', fontSize: 10 }}>
            1 — {new Date(y, m + 1, 0).getDate()} {['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][m]}
          </div>
        </div>
        <button
          onClick={nextMonth}
          disabled={y === new Date().getFullYear() && m === new Date().getMonth()}
          className="bg-transparent border-0 cursor-pointer disabled:opacity-30"
          style={{ color: '#555' }}
        >›</button>
      </div>

      {/* v0.34: переключатель вида Расходы/Доходы/Баланс */}
      <div className="px-5 mb-4 flex gap-1.5">
        {(['expense', 'income', 'balance'] as const).map((v) => (
          <button
            key={v}
            onClick={() => { haptic.select(); setViewMode(v) }}
            className="flex-1 py-1.5 cursor-pointer text-[11px] font-semibold"
            style={{
              background: viewMode === v ? '#ff1744' : 'transparent',
              border: viewMode === v ? '0' : '0.5px solid #222',
              borderRadius: 999,
              color: viewMode === v ? '#fff' : '#888',
            }}
          >
            {v === 'expense' ? 'Расходы' : v === 'income' ? 'Доходы' : 'Баланс'}
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
          {/* Круговая диаграмма — 220px */}
          <div className="px-5 mb-5 flex justify-center">
            <div className="relative" style={{ width: 220, height: 220 }}>
              <svg viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="110" cy="110" r="88" fill="none" stroke="#1a1a1a" strokeWidth="24" />
                {arcs.map((a, i) => {
                  const length = (a.length / CIRCUMFERENCE) * (2 * Math.PI * 88)
                  const offset = (a.offset / CIRCUMFERENCE) * (2 * Math.PI * 88)
                  return (
                    <circle
                      key={i}
                      cx="110"
                      cy="110"
                      r="88"
                      fill="none"
                      stroke={a.color}
                      strokeWidth="24"
                      strokeDasharray={`${length} ${2 * Math.PI * 88}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div style={{ color: '#555', fontSize: 9, letterSpacing: '1px', fontWeight: 500 }}>ВСЕГО</div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                  {Math.round(totalSpend).toLocaleString('ru-RU')} ₽
                </div>
                <div style={{ color: '#666', fontSize: 10, marginTop: 1 }}>
                  {expenseTxs.length} операц{expenseTxs.length === 1 ? 'ия' : expenseTxs.length < 5 ? 'ии' : 'ий'}
                </div>
              </div>
            </div>
          </div>

          {/* Список категорий с цветными прогресс-барами */}
          <div className="px-5 mb-5 flex flex-col gap-2">
            {byCategory.map((c, i) => {
              const color = RED_SHADES[i] ?? RED_SHADES[RED_SHADES.length - 1]
              const bg = color === '#ff1744' ? 'rgba(255,23,68,0.12)'
                : color === '#ff4d8f' ? 'rgba(255,77,143,0.15)'
                : color === '#a855f7' ? 'rgba(168,85,247,0.15)'
                : color === '#3b82f6' ? 'rgba(59,130,246,0.15)'
                : 'rgba(6,182,212,0.15)'
              // Найти первую эмодзи категории
              const cat = state.categories.find((cc) => cc.id === c.id)
              const emoji = cat ? (/\p{Extended_Pictographic}/u.test(cat.icon) ? cat.icon : '📂') : '📊'
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 8, background: bg, fontSize: 14 }}
                  >
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }} className="truncate">
                        {c.name}
                      </span>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                        {Math.round(c.amount).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1" style={{ height: 3, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${c.percent}%`, height: '100%', background: color, borderRadius: 999 }} />
                      </div>
                      <span style={{ color, fontSize: 10, fontWeight: 600 }}>{c.percent}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* v0.34: Две плашки */}
          <div className="px-5 flex gap-1.5">
            <div className="flex-1" style={{ padding: 10, background: '#141414', border: '0.5px solid #222', borderRadius: 12 }}>
              <div style={{ color: '#888', fontSize: 9, letterSpacing: '0.5px' }}>СРЕДНЕЕ В ДЕНЬ</div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                {Math.round(avgPerDay).toLocaleString('ru-RU')} ₽
              </div>
            </div>
            {prevMonthSpend > 0 && (
              <div className="flex-1" style={{ padding: 10, background: '#141414', border: '0.5px solid #222', borderRadius: 12 }}>
                <div style={{ color: '#888', fontSize: 9, letterSpacing: '0.5px' }}>VS ПРОШЛЫЙ МЕС</div>
                <div style={{
                  color: diffPct <= 0 ? '#00c864' : '#ff1744',
                  fontSize: 16, fontWeight: 600, marginTop: 2,
                }}>
                  {diffPct > 0 ? '+' : ''}{diffPct}%
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
