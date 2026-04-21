import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { getUser, haptic, openTelegramLink } from '@/lib/telegram'
import { exportTransactionsCSV, downloadFile } from '@/lib/csv'
import { gradientForUser, getCustomAvatar, setCustomAvatar, removeCustomAvatar, processAvatarFile } from '@/lib/avatar'
import { APP_CHANNEL_USERNAME, APP_CHANNEL_URL } from '@/lib/version'

interface Props {
  onClose: () => void
  onOpenWipe: () => void
  onOpenGoals: () => void
  onOpenReferral: () => void
  onOpenCurrency: () => void
  onShowChangelog: () => void
  onShowOnboarding: () => void
}

type Row = {
  id: string
  icon: string
  title: string
  subtitle?: string
  onClick: () => void
  danger?: boolean
  highlight?: boolean
  rightText?: string    // крупный текст справа (например код валюты)
}

export const MainMenuSheet: React.FC<Props> = ({ onClose, onOpenWipe, onOpenGoals, onOpenReferral, onOpenCurrency, onShowChangelog, onShowOnboarding }) => {
  const state = useStore()
  const user = getUser()
  const firstName = user?.first_name ?? 'Гость'
  const username = user?.username ? `@${user.username}` : null
  const initial = firstName.charAt(0).toUpperCase()
  const { from, to } = gradientForUser(user?.id ?? user?.username ?? firstName)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [customAvatar, setCustom] = useState<string | null>(() => getCustomAvatar())
  const [tgImgFailed, setTgImgFailed] = useState(false)

  const photoUrl = customAvatar ?? (tgImgFailed ? null : user?.photo_url)
  const showPhoto = Boolean(photoUrl)

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await processAvatarFile(file)
      setCustomAvatar(dataUrl)
      setCustom(dataUrl)
      window.dispatchEvent(new Event('avatar-updated'))
      haptic.success()
    } catch (err) {
      alert(`Не удалось загрузить фото:\n${(err as Error).message}`)
      haptic.error()
    }
    // Сбрасываем input чтобы можно было выбрать тот же файл повторно
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveAvatar = () => {
    if (!customAvatar) return
    const ok = window.confirm('Удалить своё фото? Вернётся аватар из Telegram или буква.')
    if (!ok) return
    removeCustomAvatar()
    setCustom(null)
    window.dispatchEvent(new Event('avatar-updated'))
    haptic.medium()
  }

  useEffect(() => {
    const handler = () => setCustom(getCustomAvatar())
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  const handleExportAll = async () => {
    haptic.medium()
    if (state.transactions.length === 0) {
      alert('Пока нет операций для экспорта.\nДобавь хотя бы одну транзакцию.')
      return
    }
    const csv = exportTransactionsCSV(state)
    const now = new Date().toISOString().slice(0, 10)
    const result = await downloadFile(`finance_${now}.csv`, csv)
    if (result === 'downloaded') {
      alert('Файл скачан.\nОткрой «Загрузки» или проверь внизу экрана.')
    }
    onClose()
  }

  const handleExportMonth = async () => {
    haptic.medium()
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const csv = exportTransactionsCSV(state, from, to)
    const label = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`
    const result = await downloadFile(`finance_${label}.csv`, csv)
    if (result === 'downloaded') {
      alert('Файл скачан.\nОткрой «Загрузки» или проверь внизу экрана.')
    }
    onClose()
  }

  const handleRestore = async () => {
    const ok = window.confirm(
      'Восстановить данные из Telegram-облака?\n\n' +
      'Текущие локальные данные будут заменены на те, что хранятся в облаке.\n\n' +
      'Используй эту кнопку если после чистки кэша или переустановки данные пропали.'
    )
    if (!ok) return
    haptic.medium()
    const result = await state.restoreFromCloud()
    if (result.restored) {
      alert(`Восстановлено!\nТранзакций: ${result.transactions}`)
      onClose()
    } else {
      alert('В облаке нет данных для восстановления.\n\nВозможно, это первый запуск — данные начнут синхронизироваться автоматически.')
    }
  }

  // v0.34: меню структурировано по секциям под макет
  const highlightRows: Row[] = [
    {
      id: 'referral',
      icon: '🎁',
      title: 'Пригласить друга',
      subtitle: 'Плюшки после релиза беты',
      onClick: () => { haptic.select(); onOpenReferral() },
      highlight: true,
    },
    {
      id: 'channel',
      icon: '📣',
      title: 'Канал приложения',
      subtitle: `@${APP_CHANNEL_USERNAME} · анонсы и советы`,
      onClick: () => {
        haptic.select()
        openTelegramLink(APP_CHANNEL_URL)
        onClose()
      },
      highlight: true,
    },
  ]

  const settingsRows: Row[] = [
    {
      id: 'currency',
      icon: '💱',
      title: 'Основная валюта',
      onClick: () => { haptic.select(); onOpenCurrency() },
      rightText: state.settings.baseCurrency,
    },
    {
      id: 'goals',
      icon: '🎯',
      title: 'Цели накопления',
      onClick: () => { haptic.select(); onOpenGoals() },
      rightText: String((state.goals ?? []).filter((g) => !g.archived).length || ''),
    },
  ]

  const dataRows: Row[] = [
    {
      id: 'restore',
      icon: '☁️',
      title: 'Восстановить из облака',
      subtitle: 'Если данные пропали',
      onClick: handleRestore,
    },
    {
      id: 'export-month',
      icon: '📤',
      title: 'Экспорт за этот месяц',
      subtitle: 'CSV для Excel',
      onClick: handleExportMonth,
    },
    {
      id: 'export-all',
      icon: '📦',
      title: 'Экспорт всей истории',
      subtitle: `${state.transactions.length} операций`,
      onClick: handleExportAll,
    },
  ]

  const aboutRows: Row[] = [
    {
      id: 'whats-new',
      icon: '✨',
      title: 'Что нового',
      subtitle: 'Версия v0.38',
      onClick: () => { haptic.select(); onShowChangelog() },
    },
    {
      id: 'onboarding',
      icon: '💡',
      title: 'Подсказки заново',
      subtitle: 'Показать онбординг',
      onClick: () => { haptic.select(); onShowOnboarding() },
    },
  ]

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 flex items-end z-[60] animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-bg-secondary rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <div className="w-10 h-1 bg-bg-tertiary rounded-full mx-auto mb-5" />

        {/* Профиль */}
        <div className="flex items-center gap-3 mb-5 px-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative border-0 cursor-pointer active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            aria-label="Загрузить своё фото"
          >
            <span className="text-lg font-medium text-white">{initial}</span>
            {showPhoto && (
              <img
                src={photoUrl!}
                alt={firstName}
                onError={() => { if (!customAvatar) setTgImgFailed(true) }}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Подсказка на наведении */}
            <span className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-xs text-white">📷</span>
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-base font-medium truncate">{firstName}</div>
            {username && (
              <div className="text-xs text-text-muted truncate">{username}</div>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-accent bg-transparent border-0 cursor-pointer p-0"
              >
                {customAvatar ? 'Заменить фото' : 'Загрузить фото'}
              </button>
              {customAvatar && (
                <>
                  <span className="text-text-faint text-[11px]">·</span>
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-[11px] text-text-muted bg-transparent border-0 cursor-pointer p-0"
                  >
                    Убрать
                  </button>
                </>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>

        {/* Highlight-кнопки: Пригласить + Канал */}
        <div className="space-y-2 mb-4">
          {highlightRows.map((r) => {
            const isReferral = r.id === 'referral'
            const bg = isReferral ? 'rgba(0,200,100,0.1)' : 'rgba(255,23,68,0.1)'
            const border = isReferral ? '0.5px solid rgba(0,200,100,0.4)' : '0.5px solid rgba(255,23,68,0.4)'
            const shadow = isReferral
              ? '0 0 14px rgba(0,200,100,0.45)'
              : '0 0 18px rgba(255,23,68,0.7)'
            const subColor = isReferral ? '#4ae290' : '#ff6188'
            const iconBg = isReferral ? 'rgba(0,200,100,0.18)' : 'rgba(255,23,68,0.18)'
            const iconBorder = isReferral ? '1px solid rgba(0,200,100,0.55)' : '1px solid rgba(255,23,68,0.55)'
            const iconShadow = isReferral
              ? '0 0 12px rgba(0,200,100,0.5)'
              : '0 0 14px rgba(255,23,68,0.7)'
            return (
              <button
                key={r.id}
                onClick={r.onClick}
                className="w-full flex items-center cursor-pointer text-left active:scale-[0.98] transition-transform"
                style={{
                  padding: '11px 13px',
                  background: bg,
                  border,
                  borderRadius: 12,
                  gap: 11,
                  boxShadow: shadow,
                  animation: isReferral ? undefined : 'pulse-glow 2.5s ease-in-out infinite',
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: iconBg, border: iconBorder,
                    boxShadow: iconShadow, fontSize: 17,
                  }}
                >
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                  <div style={{ color: subColor, fontSize: 10, marginTop: 1 }}>{r.subtitle}</div>
                </div>
                <span style={{ color: '#555', fontSize: 14 }}>›</span>
              </button>
            )
          })}
        </div>

        <MenuSection label="НАСТРОЙКИ" rows={settingsRows} />
        <MenuSection label="ДАННЫЕ" rows={dataRows} />
        <MenuSection label="О ПРИЛОЖЕНИИ" rows={aboutRows} />

        {/* Стереть все данные */}
        <button
          onClick={() => { haptic.warning(); onOpenWipe() }}
          className="w-full cursor-pointer active:scale-[0.98] transition-transform"
          style={{
            padding: 11,
            background: 'transparent',
            border: '0.5px solid rgba(255,23,68,0.3)',
            borderRadius: 12,
            color: '#ff1744',
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          🗑 Стереть все данные
        </button>

        <div className="text-center" style={{ color: '#444', fontSize: 10 }}>
          Сохранёнки · v0.35 beta
        </div>
      </div>
    </div>
  )
}

const MenuSection: React.FC<{ label: string; rows: Row[] }> = ({ label, rows }) => (
  <>
    <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500, marginBottom: 6, paddingLeft: 2 }}>
      {label}
    </div>
    <div
      style={{
        background: '#141414',
        border: '0.5px solid #222',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 14,
      }}
    >
      {rows.map((r, i) => (
        <button
          key={r.id}
          onClick={r.onClick}
          className="w-full flex items-center cursor-pointer text-left active:scale-[0.98] transition-transform"
          style={{
            padding: '11px 13px',
            background: 'transparent',
            border: 0,
            gap: 10,
            borderBottom: i < rows.length - 1 ? '0.5px solid #1a1a1a' : undefined,
          }}
        >
          <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{r.icon}</span>
          <div className="flex-1 text-left">
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{r.title}</div>
            {r.subtitle && (
              <div style={{ color: '#666', fontSize: 10 }}>{r.subtitle}</div>
            )}
          </div>
          {r.rightText && (
            <span style={{
              color: r.id === 'currency' ? '#ff1744' : '#888',
              fontSize: 12,
              fontWeight: r.id === 'currency' ? 500 : 400,
            }}>
              {r.rightText}
            </span>
          )}
          <span style={{ color: '#555', fontSize: 12, marginLeft: 6 }}>›</span>
        </button>
      ))}
    </div>
  </>
)
