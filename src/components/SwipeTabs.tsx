import { useRef, useState, ReactNode } from 'react'
import { haptic } from '@/lib/telegram'

type TxType = 'expense' | 'income' | 'transfer'

interface Props {
  current: TxType
  onSwitch: (next: TxType) => void
  children: ReactNode
}

const ORDER: TxType[] = ['expense', 'income', 'transfer']
const LABELS: Record<TxType, string> = {
  expense:  'Расход',
  income:   'Доход',
  transfer: 'Перевод',
}
const THRESHOLD = 80
const EDGE_IGNORE = 20

export const SwipeTabs: React.FC<Props> = ({ current, onSwitch, children }) => {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const locked = useRef<null | 'h' | 'v'>(null)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  const idx = ORDER.indexOf(current)
  const canLeft = idx > 0
  const canRight = idx < ORDER.length - 1
  const prev: TxType | null = canLeft ? ORDER[idx - 1] : null
  const next: TxType | null = canRight ? ORDER[idx + 1] : null

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return
    const t = e.touches[0]
    if (t.clientX < EDGE_IGNORE) return
    startX.current = t.clientX
    startY.current = t.clientY
    locked.current = null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return
    const t = e.touches[0]
    const dx = t.clientX - startX.current
    const dy = t.clientY - startY.current

    if (locked.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      locked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (locked.current !== 'h') return

    let limited = dx
    if (dx > 0 && !canLeft) limited = dx / 4
    if (dx < 0 && !canRight) limited = dx / 4
    setOffset(limited)
  }

  const onTouchEnd = () => {
    if (startX.current === null) return
    const finalOffset = offset
    startX.current = null
    startY.current = null

    if (locked.current !== 'h') {
      locked.current = null
      return
    }
    locked.current = null

    const width = window.innerWidth

    if (finalOffset < -THRESHOLD && canRight) {
      haptic.select()
      setAnimating(true)
      setOffset(-width)
      setTimeout(() => {
        onSwitch(ORDER[idx + 1])
        setAnimating(false)
        setOffset(0)
      }, 220)
    } else if (finalOffset > THRESHOLD && canLeft) {
      haptic.select()
      setAnimating(true)
      setOffset(width)
      setTimeout(() => {
        onSwitch(ORDER[idx - 1])
        setAnimating(false)
        setOffset(0)
      }, 220)
    } else {
      setAnimating(true)
      setOffset(0)
      setTimeout(() => setAnimating(false), 220)
    }
  }

  const renderPreview = (side: 'left' | 'right', label: string | null) => {
    if (!label) return null
    const visible = side === 'left' ? offset > 8 : offset < -8
    if (!visible) return null
    const intensity = Math.min(1, Math.abs(offset) / 140)
    const w = Math.min(Math.abs(offset), 140)
    return (
      <div
        className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none bg-bg-secondary"
        style={{
          [side]: 0,
          width: w,
          borderLeft: side === 'right' ? '0.5px solid rgb(var(--c-border))' : 'none',
          borderRight: side === 'left'  ? '0.5px solid rgb(var(--c-border))' : 'none',
        }}
      >
        <div
          className="flex flex-col items-center gap-1"
          style={{ opacity: intensity, transform: `scale(${0.85 + intensity * 0.15})` }}
        >
          <div className="text-accent text-2xl font-light">
            {side === 'left' ? '‹' : '›'}
          </div>
          <div className="text-xs text-text-secondary font-medium">{label}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative h-full overflow-hidden bg-bg-primary"
    >
      {renderPreview('left',  prev ? LABELS[prev] : null)}
      {renderPreview('right', next ? LABELS[next] : null)}

      <div
        className="flex flex-col h-full bg-bg-primary relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          willChange: 'transform',
          zIndex: 2,
        }}
      >
        {children}
      </div>
    </div>
  )
}
