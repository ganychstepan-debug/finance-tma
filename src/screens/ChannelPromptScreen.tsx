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
        {/* v0.34: Иконка 120×120 скруглённая (не круг) */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 120,
            height: 120,
            borderRadius: 34,
            background: 'linear-gradient(135deg, #ff1744, #8a001c)',
            boxShadow: '0 0 60px rgba(255,23,68,0.55), 0 0 100px rgba(255,23,68,0.3)',
            animation: 'pulse-glow 2.8s ease-in-out infinite',
            fontSize: 60,
          }}
        >
          📣
        </div>

        {/* Заголовок в 2 строки */}
        <div style={{
          color: '#fff',
          fontSize: 28,
          fontWeight: 700,
          marginTop: 28,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          Канал<br/>приложения
        </div>

        {/* Пилюля @savemoney_app */}
        <div
          className="inline-flex items-center"
          style={{
            gap: 6,
            marginTop: 14,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(255,23,68,0.1)',
            border: '0.5px solid rgba(255,23,68,0.3)',
          }}
        >
          <span style={{ color: '#ff1744', fontSize: 13, fontWeight: 600 }}>
            @{APP_CHANNEL_USERNAME}
          </span>
        </div>

        {/* Подзаголовок */}
        <div style={{
          color: '#bbb',
          fontSize: 14,
          marginTop: 22,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.5,
        }}>
          Новости релизов, подсказки по учёту финансов и редкие плюшки для подписчиков
        </div>

        {/* 3 карточки фич */}
        <div
          className="flex flex-col"
          style={{ gap: 8, marginTop: 26, width: '100%', maxWidth: 300 }}
        >
          <FeatureRow icon="✨" text="Новые функции — узнаешь первым" />
          <FeatureRow icon="💡" text="Разборы: как копить и не тратить" />
          <FeatureRow icon="🎁" text="Ранний доступ к бонусам после беты" />
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
          className="w-full cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center"
          style={{
            padding: 16,
            background: '#ff1744',
            border: 0,
            borderRadius: 14,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 24px rgba(255,23,68,0.5)',
            gap: 8,
            maxWidth: 300,
            margin: '0 auto',
          }}
        >
          <span>{joining ? 'Открываем…' : 'Подписаться'}</span>
          {!joining && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 17L17 7M17 7H8M17 7V16"/>
            </svg>
          )}
        </button>
        <button
          onClick={handleSkip}
          className="w-full bg-transparent border-0 cursor-pointer"
          style={{ padding: '8px 14px', marginTop: 10, color: '#666', fontSize: 12 }}
        >
          Позже
        </button>
      </div>
    </div>
  )
}

const FeatureRow: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div
    className="flex items-center"
    style={{
      gap: 10,
      padding: '10px 14px',
      background: 'rgba(20,20,20,0.7)',
      border: '0.5px solid #222',
      borderRadius: 12,
    }}
  >
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span style={{ color: '#ddd', fontSize: 12 }}>{text}</span>
  </div>
)
