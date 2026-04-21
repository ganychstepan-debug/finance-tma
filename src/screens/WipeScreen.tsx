import { useState } from 'react'
import { useStore } from '@/store'
import { haptic, showPopup } from '@/lib/telegram'
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

  const handleWipePeriod = async () => {
    if (matchCount === 0) return
    const pressed = await showPopup({
      title: `Удалить ${matchCount} ${pluralizeOps(matchCount)}?`,
      message: `За период ${from} — ${to}. Балансы счетов пересчитаются. Категории и долги не тронутся.`,
      buttons: [
        { id: 'cancel', type: 'cancel', text: 'Отмена' },
        { id: 'confirm', type: 'destructive', text: 'Удалить' },
      ],
    })
    if (pressed !== 'confirm') return
    haptic.warning()
    const removed = wipeTransactions(
      new Date(from + 'T00:00:00').toISOString(),
      new Date(to + 'T23:59:59').toISOString()
    )
    await showPopup({
      title: 'Готово',
      message: `Удалено операций: ${removed}`,
      buttons: [{ type: 'ok', text: 'OK' }],
    })
    onClose()
  }

  const handleWipeAll = async () => {
    const p1 = await showPopup({
      title: 'Удалить всё?',
      message: 'Счета, транзакции, долги, свои категории и настройки — всё будет стёрто. Действие необратимо.',
      buttons: [
        { id: 'cancel', type: 'cancel', text: 'Отмена' },
        { id: 'next', type: 'destructive', text: 'Продолжить' },
      ],
    })
    if (p1 !== 'next') return
    const p2 = await showPopup({
      title: 'Точно удалить всё?',
      message: 'Данные не восстановить.',
      buttons: [
        { id: 'cancel', type: 'cancel', text: 'Отмена' },
        { id: 'wipe', type: 'destructive', text: 'Удалить всё' },
      ],
    })
    if (p2 !== 'wipe') return
    haptic.error()
    wipeAll()
    onClose()
  }

  const pluralizeOps = (n: number): string => {
    const m10 = n % 10
    const m100 = n % 100
    if (m10 === 1 && m100 !== 11) return 'операцию'
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'операции'
    return 'операций'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Удалить данные</div>
        <div className="w-12" />
      </div>

      <div className="px-4 pt-2 pb-10 flex flex-col" style={{ gap: 20 }}>

        {/* Удаление за период */}
        <section>
          <div
            className="mb-2"
            style={{ color: '#888', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}
          >
            Удалить операции за период
          </div>
          <div
            style={{
              padding: 14,
              background: '#141414',
              border: '0.5px solid #222',
              borderRadius: 16,
            }}
          >
            <div className="flex mb-2.5" style={{ gap: 5 }}>
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
                  className="flex-1 border-0 cursor-pointer"
                  style={{
                    padding: '6px 0',
                    background: '#1f1f1f',
                    borderRadius: 6,
                    color: '#ccc',
                    fontSize: 11,
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>

            <label className="block mb-2.5">
              <div style={{ color: '#666', fontSize: 9, letterSpacing: '0.5px', marginBottom: 4 }}>
                С ДАТЫ
              </div>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
                className="w-full border-0 box-border"
                style={{
                  padding: '10px 13px',
                  background: '#1f1f1f',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 12,
                  colorScheme: 'dark',
                }}
              />
            </label>

            <label className="block mb-3">
              <div style={{ color: '#666', fontSize: 9, letterSpacing: '0.5px', marginBottom: 4 }}>
                ПО ДАТУ
              </div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                className="w-full border-0 box-border"
                style={{
                  padding: '10px 13px',
                  background: '#1f1f1f',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 12,
                  colorScheme: 'dark',
                }}
              />
            </label>

            <div className="mb-2.5" style={{ color: '#888', fontSize: 11 }}>
              Попадёт под удаление:{' '}
              <span style={{
                color: matchCount > 0 ? '#ff1744' : '#888',
                fontWeight: matchCount > 0 ? 600 : 400,
              }}>
                {matchCount} операций
              </span>
            </div>

            <button
              onClick={handleWipePeriod}
              disabled={matchCount === 0}
              className="w-full border-0 cursor-pointer"
              style={{
                padding: 11,
                background: matchCount > 0 ? '#ff1744' : '#1f1f1f',
                borderRadius: 10,
                color: matchCount > 0 ? '#fff' : '#555',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Удалить {matchCount > 0 ? `(${matchCount})` : ''}
            </button>
          </div>
        </section>

        {/* Удаление всего */}
        <section>
          <div
            className="mb-2"
            style={{ color: '#888', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}
          >
            Опасная зона
          </div>
          <div
            style={{
              padding: 14,
              background: '#141414',
              border: '0.5px solid rgba(255,23,68,0.3)',
              borderRadius: 16,
            }}
          >
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
              Удалить всё полностью
            </div>
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
              Счета, операции, категории, долги, настройки. Без возможности восстановить.
            </div>
            <button
              onClick={handleWipeAll}
              className="w-full bg-transparent cursor-pointer"
              style={{
                padding: 11,
                border: '1px solid #ff1744',
                borderRadius: 10,
                color: '#ff1744',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Сбросить приложение
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
