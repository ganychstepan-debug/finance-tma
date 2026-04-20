import { useState } from 'react'
import { haptic, openLink } from '@/lib/telegram'

interface Props {
  onDone: () => void
}

interface Slide {
  title: string
  text: string
  emoji: string
  hint?: string
  kind?: 'home-screen'
}

const SLIDES: Slide[] = [
  {
    emoji: '💳',
    title: 'Быстрый учёт расходов',
    text: 'Добавляй счета и транзакции, следи за балансом и бюджетами. Данные хранятся локально — никому не уходят.',
  },
  {
    emoji: '☁️',
    title: 'Это бета-версия',
    text: 'Данные сохраняются в твой Telegram-аккаунт и не потеряются при переустановке. Но рекомендуем периодически делать экспорт в CSV — через меню (тап на аватар → «Экспорт»).',
    hint: 'Меню → Экспорт всей истории',
  },
  {
    emoji: '📌',
    title: 'Закрепи для быстрого доступа',
    text: 'Чтобы открывать приложение одним тапом — удерживай чат с ботом в списке Telegram и нажми «Закрепить».',
    hint: 'Список чатов → долгий тап → 📌',
  },
  {
    emoji: '🏠',
    title: 'Иконка на рабочем столе',
    text: 'Для iOS: открой приложение в Safari → Поделиться → «На экран Домой». Получишь отдельную иконку.',
    hint: 'Откроем это сейчас ↓',
    kind: 'home-screen',
  },
]

export const OnboardingScreen: React.FC<Props> = ({ onDone }) => {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const next = () => {
    haptic.light()
    if (isLast) {
      onDone()
    } else {
      setIdx(idx + 1)
    }
  }

  const skip = () => {
    haptic.light()
    onDone()
  }

  const openInSafari = () => {
    haptic.medium()
    const url = window.location.origin
    openLink(url)
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="px-5 pt-4 pb-2 flex justify-between items-center">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all"
              style={{
                width: i === idx ? 24 : 6,
                backgroundColor: i === idx ? '#ff0033' : i < idx ? 'rgba(255,0,51,0.4)' : '#333',
              }}
            />
          ))}
        </div>
        {!isLast && (
          <button
            onClick={skip}
            className="text-text-muted text-xs bg-transparent border-0 cursor-pointer"
          >
            Пропустить
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-8 text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-8 animate-fade-in"
          style={{
            background: 'radial-gradient(circle, rgba(255,0,51,0.15) 0%, rgba(255,0,51,0) 70%)',
          }}
        >
          <span>{slide.emoji}</span>
        </div>

        <div
          className="text-2xl font-medium mb-4 leading-tight"
          style={{ fontFamily: '"SF Pro Rounded", "SF Pro Display", -apple-system, system-ui, sans-serif' }}
        >
          {slide.title}
        </div>

        <div className="text-sm text-text-secondary leading-relaxed mb-6 max-w-xs">
          {slide.text}
        </div>

        {slide.hint && (
          <div className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-btn px-3 py-2">
            {slide.hint}
          </div>
        )}

        {slide.kind === 'home-screen' && (
          <button
            onClick={openInSafari}
            className="mt-6 py-3 px-6 bg-bg-secondary border border-border rounded-btn text-white text-sm cursor-pointer"
          >
            📱 Открыть в Safari
          </button>
        )}
      </div>

      <div
        className="px-5 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <button
          onClick={next}
          className="w-full py-4 bg-accent border-0 rounded-btn text-white text-base font-medium cursor-pointer shadow-[0_4px_20px_rgba(255,0,51,0.4)]"
        >
          {isLast ? 'Начать пользоваться' : 'Дальше'}
        </button>
        {idx > 0 && !isLast && (
          <button
            onClick={() => { haptic.light(); setIdx(idx - 1) }}
            className="w-full py-3 mt-2 bg-transparent border-0 text-text-muted text-sm cursor-pointer"
          >
            Назад
          </button>
        )}
      </div>
    </div>
  )
}
