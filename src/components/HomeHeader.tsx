import { useState, useEffect } from 'react'
import { haptic, getUser } from '@/lib/telegram'
import { formatMonth } from '@/lib/formatters'
import { gradientForUser, getCustomAvatar } from '@/lib/avatar'
import { useStore } from '@/store'

interface Props {
  month: Date
  onMonthChange: (d: Date) => void
  onMenuOpen: () => void
  onOpenCurrency: () => void
}

export const HomeHeader: React.FC<Props> = ({ month, onMonthChange, onMenuOpen, onOpenCurrency }) => {
  const user = getUser()
  const firstName = user?.first_name ?? 'Гость'
  const initial = firstName.charAt(0).toUpperCase()
  const { from, to } = gradientForUser(user?.id ?? user?.username ?? firstName)
  const baseCurrency = useStore((s) => s.settings.baseCurrency)

  const [customAvatar, setCustom] = useState<string | null>(() => getCustomAvatar())
  const [tgImgFailed, setTgImgFailed] = useState(false)

  // v0.82: подсказка что аватарка = меню. Флаг в localStorage, показывается
  // пока юзер хоть раз не откроет меню (тап по аватарке снимает флаг).
  const [showMenuHint, setShowMenuHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem('menu_hint_dismissed') !== '1'
    } catch {
      return false
    }
  })
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (!showMenuHint) return
    // Тултип появляется на 500мс позже и висит ~3 сек (анимация сама)
    const t = setTimeout(() => setShowTooltip(true), 500)
    const hide = setTimeout(() => setShowTooltip(false), 500 + 3200)
    return () => { clearTimeout(t); clearTimeout(hide) }
  }, [showMenuHint])

  const dismissMenuHint = () => {
    if (!showMenuHint) return
    setShowMenuHint(false)
    setShowTooltip(false)
    try { localStorage.setItem('menu_hint_dismissed', '1') } catch {}
  }

  useEffect(() => {
    const handler = () => setCustom(getCustomAvatar())
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  const photoUrl = customAvatar ?? (tgImgFailed ? null : user?.photo_url)
  const showPhoto = Boolean(photoUrl)

  const prev = () => {
    haptic.select()
    onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))
  }
  const next = () => {
    haptic.select()
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
  }

  return (
    <div className="px-5 pt-2 pb-0 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <button onClick={prev} className="text-text-muted px-1 bg-transparent border-0 cursor-pointer text-lg leading-none">‹</button>
        <div>
          <div className="text-2xs text-text-muted uppercase tracking-wide">{formatMonth(month)}</div>
          <div className="text-sm text-text-secondary mt-0.5">Привет, {firstName}</div>
        </div>
        <button onClick={next} className="text-text-muted px-1 bg-transparent border-0 cursor-pointer text-lg leading-none">›</button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { haptic.select(); onOpenCurrency() }}
          className="px-2.5 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          aria-label="Основная валюта"
        >
          <span className="text-xs font-medium text-accent tracking-wide">{baseCurrency}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => { haptic.light(); dismissMenuHint(); onMenuOpen() }}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-0 cursor-pointer active:scale-95 transition-transform overflow-hidden relative ${showMenuHint ? 'menu-hint-pulse' : ''}`}
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            aria-label="Меню"
          >
            <span className="text-sm font-medium text-white">{initial}</span>

            {showPhoto && (
              <img
                src={photoUrl!}
                alt={firstName}
                onError={() => {
                  if (!customAvatar) setTgImgFailed(true)
                }}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </button>

          {showMenuHint && showTooltip && (
            <div
              className="menu-hint-tooltip absolute right-0 top-full mt-2 pointer-events-none z-50"
              style={{ whiteSpace: 'nowrap' }}
            >
              <div className="relative">
                <div
                  className="absolute -top-1 right-3 w-2 h-2 rotate-45"
                  style={{ background: '#ff1744' }}
                />
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: '#ff1744', boxShadow: '0 4px 12px rgba(255,23,68,0.4)' }}
                >
                  Меню здесь
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
