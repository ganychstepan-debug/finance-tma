import { useRef, useState, useEffect } from 'react'
import { haptic } from '@/lib/telegram'

interface Props {
  children: React.ReactNode
  onDelete: () => void          // вызывается после подтверждения
  confirmLabel?: string          // что писать в подтверждении
  disabled?: boolean
}

const SWIPE_THRESHOLD = 70        // px — минимум чтобы открылась кнопка
const ACTION_WIDTH    = 80        // ширина красной зоны «Удалить»
const AUTO_DELETE     = 200       // если увёл далеко — показывает confirm сразу

/**
 * Свайп влево (touch и mouse). После открытия показывает красную «Удалить».
 * Тап в любом другом месте — закрывает.
 */
export const SwipeableRow: React.FC<Props> = ({ children, onDelete, confirmLabel, disabled }) => {
  const [dx, setDx] = useState(0)            // текущий сдвиг (отрицательное число)
  const [opened, setOpened] = useState(false)
  const startX = useRef(0)
  const startDx = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Клик вне — закрыть открытую панель
  useEffect(() => {
    if (!opened) return
    const onDocClick = (e: Event) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpened(false)
        setDx(0)
      }
    }
    document.addEventListener('pointerdown', onDocClick)
    return () => document.removeEventListener('pointerdown', onDocClick)
  }, [opened])

  const start = (x: number) => {
    if (disabled) return
    dragging.current = true
    moved.current = false
    startX.current = x
    startDx.current = dx
  }

  const move = (x: number) => {
    if (!dragging.current) return
    const delta = x - startX.current
    const next = Math.min(0, Math.max(-ACTION_WIDTH - 30, startDx.current + delta))
    if (Math.abs(delta) > 4) moved.current = true
    setDx(next)
  }

  const end = () => {
    if (!dragging.current) return
    dragging.current = false

    // Если увёл очень далеко — сразу предложить удалить
    if (dx <= -AUTO_DELETE) {
      triggerDelete()
      return
    }

    if (dx <= -SWIPE_THRESHOLD) {
      haptic.light()
      setDx(-ACTION_WIDTH)
      setOpened(true)
    } else {
      setDx(0)
      setOpened(false)
    }
  }

  const triggerDelete = () => {
    haptic.warning()
    const ok = window.confirm(confirmLabel ?? 'Удалить эту операцию?\nБаланс счёта будет пересчитан.')
    if (ok) {
      setDx(0)
      setOpened(false)
      onDelete()
    } else {
      setDx(0)
      setOpened(false)
    }
  }

  // Mouse (для теста в браузере)
  const onMouseDown = (e: React.MouseEvent) => start(e.clientX)
  const onMouseMove = (e: React.MouseEvent) => move(e.clientX)
  const onMouseUp   = () => end()

  // Touch (для мобилки)
  const onTouchStart = (e: React.TouchEvent) => start(e.touches[0].clientX)
  const onTouchMove  = (e: React.TouchEvent) => move(e.touches[0].clientX)
  const onTouchEnd   = () => end()

  return (
    <div ref={containerRef} className="relative overflow-hidden select-none">
      {/* Красная подложка (видна когда едет содержимое) */}
      <div
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center bg-accent"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); triggerDelete() }}
          className="w-full h-full bg-transparent border-0 text-white text-xs font-medium cursor-pointer flex flex-col items-center justify-center gap-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"/>
          </svg>
          <span className="text-[10px]">Удалить</span>
        </button>
      </div>

      {/* Контент, который сдвигается */}
      <div
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { if (dragging.current) end() }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          // Если только что свайпнули — блокируем клик, чтобы не открыть редактирование
          if (moved.current) {
            e.stopPropagation()
            e.preventDefault()
            moved.current = false
          }
        }}
        className="relative bg-bg-primary"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging.current ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
