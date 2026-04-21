import { useState } from 'react'
import { haptic, openTelegramLink } from '@/lib/telegram'
import { APP_CHANNEL_URL, APP_CHANNEL_USERNAME } from '@/lib/version'

interface Props {
  onDone: () => void
}

export const ChannelPromptScreen: React.FC<Props> = ({ onDone }) => {
  const [joining, setJoining] = useState(false)

  const handleJoin = () => {
    haptic.success()
    setJoining(true)
    openTelegramLink(APP_CHANNEL_URL)
    // Даём 300ms для перехода в Telegram, потом закрываем попап
    setTimeout(() => { onDone() }, 300)
  }

  const handleSkip = () => {
    haptic.light()
    onDone()
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary relative overflow-hidden">
      {/* Фоновое свечение */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(var(--c-accent-glow-strong),0.18), transparent 60%)',
        }}
      />
      {/* Декоративные полосы внизу */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(var(--c-accent-glow-strong),0.08), transparent)',
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10">
        {/* Большая иконка с пульсом */}
        <div className="relative mb-6">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{
              background: 'linear-gradient(135deg, #ff1744, #8a001c)',
              boxShadow: '0 0 60px rgba(255,23,68,0.55), 0 0 100px rgba(255,23,68,0.3)',
              animation: 'pulse-glow 2.8s ease-in-out infinite',
            }}
          >
            📢
          </div>
        </div>

        {/* Заголовок */}
        <div className="text-3xl font-semibold mb-3 leading-tight">
          Будь в курсе первым
        </div>
        <div className="text-base text-text-secondary mb-2 max-w-xs leading-relaxed">
          Вступай в канал приложения
        </div>
        <div className="text-sm text-accent font-medium mb-8">
          @{APP_CHANNEL_USERNAME}
        </div>

        {/* Что будет в канале */}
        <div className="bg-bg-secondary/60 backdrop-blur rounded-card p-4 mb-8 max-w-sm w-full border border-border">
          <div className="space-y-2.5 text-left">
            <BulletItem text="Анонсы обновлений и новых фич" />
            <BulletItem text="Советы как тратить меньше" />
            <BulletItem text="Голосования за следующие фичи" />
            <BulletItem text="Быстрая поддержка и фидбэк" />
          </div>
        </div>
      </div>

      {/* Кнопки внизу */}
      <div
        className="px-5 pt-3 shrink-0 relative z-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-4 rounded-btn text-base font-medium cursor-pointer bg-accent text-white border-0 shadow-[0_4px_24px_rgba(var(--c-accent-glow-strong),0.5)] active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <span>{joining ? 'Открываем...' : 'Вступить в канал'}</span>
          {!joining && <span className="text-lg leading-none">→</span>}
        </button>
        <button
          onClick={handleSkip}
          className="w-full py-3 mt-2 bg-transparent border-0 text-sm text-text-muted cursor-pointer active:text-text-secondary"
        >
          Позже
        </button>
      </div>
    </div>
  )
}

const BulletItem: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-accent text-sm mt-0.5 shrink-0 leading-none">●</span>
    <span className="text-sm text-white leading-snug">{text}</span>
  </div>
)
