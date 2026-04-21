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
    <div className="fixed inset-0 z-[200] flex items-end" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto animate-slideUp"
        style={{
          background: '#0f0f0f',
          borderRadius: '24px 24px 0 0',
          padding: '18px 18px 32px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        }}
      >
        <div className="flex justify-between items-center mb-3.5">
          <div style={{ color: '#888', fontSize: 11 }}>📊 Итоги недели</div>
          <button
            onClick={handleClose}
            className="bg-transparent border-0 cursor-pointer"
            style={{ color: '#666', fontSize: 11 }}
          >
            Закрыть
          </button>
        </div>

        <div className="text-center mb-5">
          <div style={{ color: '#555', fontSize: 10, letterSpacing: '1.3px', fontWeight: 500, textTransform: 'uppercase' }}>
            {formatDateShort(stats.weekStart)} — {formatDateShort(stats.weekEnd)}
          </div>
        </div>

        {!stats.hasData ? (
          <div className="py-10 text-center">
            <div className="text-4xl mb-3">💤</div>
            <div style={{ color: '#888', fontSize: 13 }}>Нет записей за прошлую неделю</div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Начни записывать траты — сводка появится в следующий раз</div>
          </div>
        ) : (
          <>
            {/* Расходы и доходы — две плашки */}
            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
              <div style={{ padding: 14, background: '#141414', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: 9, letterSpacing: '1.3px', fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>
                  Потрачено
                </div>
                <div style={{ color: '#ff1744', fontSize: 19, fontWeight: 500 }}>
                  −{formatMoney(stats.expenses, baseCurrency)}
                </div>
              </div>
              <div style={{ padding: 14, background: '#141414', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: 9, letterSpacing: '1.3px', fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>
                  Доходы
                </div>
                <div style={{ color: '#00c864', fontSize: 19, fontWeight: 500 }}>
                  +{formatMoney(stats.income, baseCurrency)}
                </div>
              </div>
            </div>

            {/* Баланс */}
            <div
              style={{
                padding: 14,
                background: stats.net >= 0 ? 'rgba(0,200,100,0.08)' : 'rgba(255,23,68,0.08)',
                border: `0.5px solid ${stats.net >= 0 ? 'rgba(0,200,100,0.3)' : 'rgba(255,23,68,0.3)'}`,
                borderRadius: 12,
                textAlign: 'center',
                marginBottom: 22,
              }}
            >
              <div style={{ color: '#666', fontSize: 9, letterSpacing: '1.3px', fontWeight: 500, textTransform: 'uppercase', marginBottom: 4 }}>
                Итог недели
              </div>
              <div style={{ color: stats.net >= 0 ? '#00c864' : '#ff1744', fontSize: 24, fontWeight: 500 }}>
                {stats.net >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(stats.net), baseCurrency)}
              </div>
            </div>

            {/* Топ категории */}
            {stats.topCategories.length > 0 && (
              <div>
                <div
                  style={{
                    color: '#666', fontSize: 10, letterSpacing: '1.3px', fontWeight: 500,
                    textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4,
                  }}
                >
                  Куда уходили деньги
                </div>
                <div className="flex flex-col" style={{ gap: 6, marginBottom: 18 }}>
                  {stats.topCategories.map(({ cat, amount }, i) => {
                    const isEmojiString = /\p{Extended_Pictographic}/u.test(cat!.icon)
                    return (
                      <div
                        key={cat!.id}
                        className="flex items-center"
                        style={{ gap: 10, padding: 10, background: '#141414', borderRadius: 11 }}
                      >
                        <div style={{ color: '#555', fontSize: 14, width: 14, textAlign: 'center' }}>
                          {i + 1}
                        </div>
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: 32, height: 32,
                            background: 'rgba(255,23,68,0.12)',
                            borderRadius: 9,
                            fontSize: 16,
                          }}
                        >
                          {isEmojiString ? cat!.icon : <CategoryIcon iconId={cat!.icon} size="sm" />}
                        </div>
                        <div className="flex-1" style={{ color: '#fff', fontSize: 13 }}>
                          {cat!.name}
                        </div>
                        <div style={{ color: '#ff1744', fontSize: 13, fontWeight: 500 }}>
                          −{formatMoney(amount, baseCurrency)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleClose}
          className="w-full cursor-pointer border-0 active:scale-[0.98] transition-transform"
          style={{
            padding: 14,
            background: '#ff1744',
            borderRadius: 14,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(255,23,68,0.45)',
          }}
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
