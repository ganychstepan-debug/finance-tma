import { useEffect } from 'react'
import { haptic, showBackButton } from '@/lib/telegram'

interface Props {
  onClick: () => void
  label?: string
}

/**
 * Заметная кнопка «Назад» для шапок модальных окон.
 *
 * Дополнительно показывает нативную кнопку «Назад» в шапке Telegram WebApp
 * (стрелка влево рядом с «Закрыть»), чтобы пользователь не нажимал «Закрыть»
 * по ошибке и не вылетал из приложения.
 */
export const BackButton: React.FC<Props> = ({ onClick, label = 'Назад' }) => {
  // Показываем нативную кнопку Telegram при монтировании.
  // При демонтировании она скроется автоматически.
  useEffect(() => {
    const cleanup = showBackButton(() => {
      haptic.light()
      onClick()
    })
    return cleanup
  }, [onClick])

  return (
    <button
      onClick={() => { haptic.light(); onClick() }}
      className="flex items-center gap-1 px-3 py-1.5 -ml-3 bg-bg-secondary border border-border rounded-btn text-text-secondary text-sm cursor-pointer active:scale-95 transition-transform"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>{label}</span>
    </button>
  )
}
