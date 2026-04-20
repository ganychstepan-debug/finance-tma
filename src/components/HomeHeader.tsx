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

        <button
          onClick={() => { haptic.light(); onMenuOpen() }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-0 cursor-pointer active:scale-95 transition-transform overflow-hidden relative"
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
      </div>
    </div>
  )
}
