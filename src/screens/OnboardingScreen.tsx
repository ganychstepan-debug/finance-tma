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
    title: 'Сохранёнки',
    text: 'Учёт финансов прямо в Telegram. Счета, цели, статистика и экспорт в CSV — без регистрации и лишних приложений.',
  },
  {
    emoji: '💬',
    title: 'Добавляй через бота',
    text: 'Напиши в @savemoney_gs_bot «кофе 300, такси 500, зарплата 80к» — ИИ распознает все операции. Открой приложение и подтверди.',
    hint: 'Пиши одной строкой — можно несколько',
  },
  {
    emoji: '📸',
    title: 'Скан чеков',
    text: 'Нажми кнопку «ЧЕК» в новом расходе — сфотографируй чек. ИИ прочитает сумму, магазин, дату и угадает категорию.',
    hint: 'Работает на русских чеках',
  },
  {
    emoji: '🎯',
    title: 'Цели и валюты',
    text: 'Создавай цели накопления со своим прогрессом. Работай в любой основной валюте — курсы ЦБ обновляются каждый день.',
    hint: 'Меню → Основная валюта',
  },
  {
    emoji: '☁️',
    title: 'Это бета-версия',
    text: 'Данные сохраняются в твой Telegram-аккаунт и не потеряются при переустановке. Для подстраховки — периодически делай экспорт в CSV.',
    hint: 'Меню → Экспорт в CSV',
  },
  {
    emoji: '📌',
    title: 'Закрепи для быстрого доступа',
    text: 'Чтобы открывать приложение одним тапом — удерживай чат с ботом в списке Telegram и нажми «Закрепить».',
    hint: 'Список чатов → долгий тап → 📌',
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
      <div className="px-4 pt-4 pb-2 flex justify-between items-center">
        <div className="flex" style={{ gap: 5 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="transition-all"
              style={{
                width: i === idx ? 24 : 6,
                height: 3,
                borderRadius: 2,
                backgroundColor: i === idx
                  ? '#ff1744'
                  : i < idx ? 'rgba(255,23,68,0.4)' : '#333',
              }}
            />
          ))}
        </div>
        {!isLast && (
          <button
            onClick={skip}
            className="bg-transparent border-0 cursor-pointer"
            style={{ color: '#666', fontSize: 11 }}
          >
            Пропустить
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center" style={{ padding: '40px 20px 20px' }}>
        <div
          className="flex items-center justify-center animate-fade-in"
          style={{
            width: 96, height: 96,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,23,68,0.15) 0%, rgba(255,23,68,0) 70%)',
            fontSize: 52,
            marginBottom: 28,
          }}
        >
          <span>{slide.emoji}</span>
        </div>

        <div style={{
          color: '#fff', fontSize: 22, fontWeight: 500,
          marginBottom: 14, lineHeight: 1.2, letterSpacing: '-0.01em',
          fontFamily: '"SF Pro Rounded", "SF Pro Display", -apple-system, system-ui, sans-serif',
        }}>
          {slide.title}
        </div>

        <div style={{
          color: '#aaa', fontSize: 13, lineHeight: 1.55,
          maxWidth: 280, marginBottom: 20,
        }}>
          {slide.text}
        </div>

        {slide.hint && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(255,23,68,0.1)',
            border: '0.5px solid rgba(255,23,68,0.3)',
            borderRadius: 10,
            color: '#ff1744',
            fontSize: 11,
            fontWeight: 500,
          }}>
            {slide.hint}
          </div>
        )}

        {slide.kind === 'home-screen' && (
          <button
            onClick={openInSafari}
            className="cursor-pointer"
            style={{
              marginTop: 24,
              padding: '12px 24px',
              background: '#141414',
              border: '0.5px solid #222',
              borderRadius: 10,
              color: '#fff',
              fontSize: 13,
            }}
          >
            📱 Открыть в Safari
          </button>
        )}
      </div>

      <div
        className="px-4"
        style={{ paddingTop: 8, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <button
          onClick={next}
          className="w-full cursor-pointer border-0"
          style={{
            padding: 14,
            background: '#ff1744',
            borderRadius: 14,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(255,23,68,0.4)',
            marginBottom: 6,
          }}
        >
          {isLast ? 'Начать пользоваться' : 'Дальше'}
        </button>
        {idx > 0 && !isLast && (
          <button
            onClick={() => { haptic.light(); setIdx(idx - 1) }}
            className="w-full bg-transparent border-0 cursor-pointer"
            style={{ padding: 10, color: '#666', fontSize: 12 }}
          >
            Назад
          </button>
        )}
      </div>
    </div>
  )
}
