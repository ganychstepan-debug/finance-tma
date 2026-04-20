import { useState } from 'react'
import { useStore } from '@/store'
import { haptic } from '@/lib/telegram'
import { BackButton } from '@/components/BackButton'

interface Props {
  onClose: () => void
}

const toInput = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const WipeScreen: React.FC<Props> = ({ onClose }) => {
  const { transactions, wipeTransactions, wipeAll } = useStore()

  const today = new Date()
  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [from, setFrom] = useState(toInput(monthAgo))
  const [to, setTo]     = useState(toInput(today))

  // Подсчёт попадающих транзакций
  const fromT = new Date(from + 'T00:00:00').getTime()
  const toT   = new Date(to   + 'T23:59:59').getTime()
  const matchCount = transactions.filter((t) => {
    const d = new Date(t.date).getTime()
    return d >= fromT && d <= toT
  }).length

  const handleWipePeriod = () => {
    if (matchCount === 0) return
    const ok = window.confirm(
      `Удалить ${matchCount} операций за период ${from} — ${to}?\n\nБалансы счетов будут пересчитаны. Категории и долги не тронутся.`
    )
    if (!ok) return
    haptic.warning()
    const removed = wipeTransactions(
      new Date(from + 'T00:00:00').toISOString(),
      new Date(to + 'T23:59:59').toISOString()
    )
    alert(`Удалено операций: ${removed}`)
    onClose()
  }

  const handleWipeAll = () => {
    const ok1 = window.confirm(
      'ВНИМАНИЕ! Это удалит ВСЁ:\n\n' +
      '• Все счета\n• Все транзакции\n• Все долги\n• Свои категории и бюджеты\n• Настройки\n\nДействие необратимо. Продолжить?'
    )
    if (!ok1) return
    const ok2 = window.confirm('Точно удалить всё? Данные не восстановить.')
    if (!ok2) return
    haptic.error()
    wipeAll()
    onClose()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Удалить данные</div>
        <div className="w-12" />
      </div>

      <div className="px-5 py-4 space-y-5 pb-10">

        {/* Удаление за период */}
        <section>
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-2">
            Удалить операции за период
          </div>
          <div className="p-4 bg-bg-secondary border border-border rounded-card space-y-3">

            <div className="flex gap-2 mb-2">
              {[
                { label: 'Этот месяц', range: () => {
                  const d = new Date()
                  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)]
                }},
                { label: '30 дней', range: () => {
                  const end = new Date()
                  const start = new Date()
                  start.setDate(start.getDate() - 30)
                  return [start, end]
                }},
                { label: 'Год', range: () => {
                  const d = new Date()
                  return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear(), 11, 31)]
                }},
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => {
                    haptic.select()
                    const [s, e] = q.range()
                    setFrom(toInput(s))
                    setTo(toInput(e))
                  }}
                  className="flex-1 py-1.5 bg-bg-tertiary border-0 rounded text-xs text-text-secondary cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <label className="block">
              <div className="text-2xs text-text-muted mb-1">С даты</div>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
                className="w-full px-3 py-2.5 bg-bg-tertiary border-0 rounded-btn text-white text-sm box-border"
                style={{ colorScheme: 'dark' }}
              />
            </label>

            <label className="block">
              <div className="text-2xs text-text-muted mb-1">По дату</div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                className="w-full px-3 py-2.5 bg-bg-tertiary border-0 rounded-btn text-white text-sm box-border"
                style={{ colorScheme: 'dark' }}
              />
            </label>

            <div className="text-xs text-text-muted pt-1">
              Попадёт под удаление: <span className={matchCount > 0 ? 'text-accent font-medium' : 'text-text-muted'}>
                {matchCount} операций
              </span>
            </div>

            <button
              onClick={handleWipePeriod}
              disabled={matchCount === 0}
              className={`w-full py-3 border-0 rounded-btn text-sm font-medium cursor-pointer ${
                matchCount > 0 ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-faint'
              }`}
            >
              Удалить {matchCount > 0 ? `(${matchCount})` : ''}
            </button>
          </div>
        </section>

        {/* Удаление всего */}
        <section>
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-2">Опасная зона</div>
          <div className="p-4 bg-bg-secondary border border-accent/30 rounded-card">
            <div className="text-sm font-medium mb-1">Удалить всё полностью</div>
            <div className="text-xs text-text-muted mb-3">
              Счета, операции, категории, долги, настройки. Без возможности восстановить.
            </div>
            <button
              onClick={handleWipeAll}
              className="w-full py-3 bg-transparent border border-accent rounded-btn text-accent text-sm font-medium cursor-pointer"
            >
              Сбросить приложение
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
