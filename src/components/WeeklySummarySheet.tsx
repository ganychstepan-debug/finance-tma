import { useMemo } from 'react'
import { useStore } from '@/store'
import { haptic } from '@/lib/telegram'
import { formatMoney } from '@/lib/formatters'
import { CategoryIcon } from '@/components/CategoryIcon'

interface Props {
  onClose: () => void
}

/**
 * Показывается автоматически в понедельник утром или воскресенье вечером
 * на первое открытие новой недели.
 * Трекинг показа — в localStorage key 'last_summary_shown' (YYYY-Www).
 */
export const WeeklySummarySheet: React.FC<Props> = ({ onClose }) => {
  const { transactions, categories, settings } = useStore()
  const baseCurrency = settings.baseCurrency

  const stats = useMemo(() => {
    // Прошлая неделя: с понедельника прошлой недели по воскресенье прошлой недели
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()  // 1-7 (пн-вс)
    const mondayThisWeek = new Date(now)
    mondayThisWeek.setHours(0, 0, 0, 0)
    mondayThisWeek.setDate(now.getDate() - (dayOfWeek - 1))

    const mondayLastWeek = new Date(mondayThisWeek)
    mondayLastWeek.setDate(mondayLastWeek.getDate() - 7)

    const txs = transactions.filter((t) => {
      const d = new Date(t.date)
      return d >= mondayLastWeek && d < mondayThisWeek
    })

    let expenses = 0
    let income = 0
    const byCategory: Record<string, number> = {}

    for (const tx of txs) {
      if (tx.type === 'expense') {
        expenses += tx.amount
        if (tx.categoryId) {
          byCategory[tx.categoryId] = (byCategory[tx.categoryId] || 0) + tx.amount
        }
      } else if (tx.type === 'income') {
        income += tx.amount
      }
    }

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId)
        return { cat, amount }
      })
      .filter((x) => x.cat)

    return {
      expenses,
      income,
      net: income - expenses,
      topCategories,
      hasData: txs.length > 0,
      weekStart: mondayLastWeek,
      weekEnd: new Date(mondayThisWeek.getTime() - 1),
    }
  }, [transactions, categories])

  const formatDateShort = (d: Date): string => {
    const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  }

  const handleClose = () => {
    haptic.light()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-end">
      <div className="w-full bg-bg rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto animate-slideUp">
        <div className="flex justify-between items-center mb-4">
          <div className="text-xs text-text-muted">📊 Итоги недели</div>
          <button
            onClick={handleClose}
            className="text-xs text-text-muted bg-transparent border-0 cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="text-2xs text-text-faint uppercase tracking-wide">
            {formatDateShort(stats.weekStart)} — {formatDateShort(stats.weekEnd)}
          </div>
        </div>

        {!stats.hasData ? (
          <div className="py-10 text-center">
            <div className="text-4xl mb-3">💤</div>
            <div className="text-sm text-text-muted">Нет записей за прошлую неделю</div>
            <div className="text-xs text-text-faint mt-1">Начни записывать траты — сводка появится в следующий раз</div>
          </div>
        ) : (
          <>
            {/* Расходы и доходы */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-bg-secondary rounded-btn text-center">
                <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Потрачено</div>
                <div className="text-lg font-medium text-accent">
                  {formatMoney(stats.expenses, baseCurrency)}
                </div>
              </div>
              <div className="p-3 bg-bg-secondary rounded-btn text-center">
                <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Доходы</div>
                <div className="text-lg font-medium text-success">
                  {formatMoney(stats.income, baseCurrency)}
                </div>
              </div>
            </div>

            {/* Баланс */}
            <div className={`p-3 rounded-btn text-center mb-6 ${
              stats.net >= 0 ? 'bg-success/10 border border-success/30' : 'bg-accent/10 border border-accent/30'
            }`}>
              <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                Итог недели
              </div>
              <div className={`text-xl font-medium ${stats.net >= 0 ? 'text-success' : 'text-accent'}`}>
                {stats.net >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(stats.net), baseCurrency)}
              </div>
            </div>

            {/* Топ категории */}
            {stats.topCategories.length > 0 && (
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wide mb-2 pl-1">
                  Куда уходили деньги
                </div>
                <div className="space-y-2">
                  {stats.topCategories.map(({ cat, amount }, i) => (
                    <div key={cat!.id} className="flex items-center gap-3 p-2.5 bg-bg-secondary rounded-btn">
                      <div className="text-lg text-text-muted w-4 text-center">{i + 1}</div>
                      <CategoryIcon iconId={cat!.icon} size="sm" />
                      <div className="flex-1 text-sm text-white">{cat!.name}</div>
                      <div className="text-sm text-accent font-medium">
                        {formatMoney(amount, baseCurrency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleClose}
          className="w-full mt-6 py-3 bg-accent text-white rounded-btn text-sm font-medium cursor-pointer border-0"
        >
          Продолжить
        </button>
      </div>
    </div>
  )
}

// Проверка: нужно ли показать сводку сейчас
// Критерий: сейчас понедельник или воскресенье И в localStorage не стоит что уже показали на этой неделе
export const shouldShowWeeklySummary = (): boolean => {
  try {
    const now = new Date()
    const day = now.getDay()  // 0=вс, 1=пн
    // Показываем в воскресенье вечером (после 18) или в понедельник
    const isRightDay = (day === 0 && now.getHours() >= 18) || day === 1
    if (!isRightDay) return false

    // Ключ недели: YYYY-Www (ISO week)
    const weekKey = getISOWeekKey(now)
    const lastShown = localStorage.getItem('last_summary_shown')
    return lastShown !== weekKey
  } catch {
    return false
  }
}

export const markWeeklySummaryShown = () => {
  try {
    localStorage.setItem('last_summary_shown', getISOWeekKey(new Date()))
  } catch {}
}

const getISOWeekKey = (d: Date): string => {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 4 - (date.getDay() || 7))
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
