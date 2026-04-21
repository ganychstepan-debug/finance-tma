import { useEffect } from 'react'
import { haptic } from '@/lib/telegram'
import { formatMoney } from '@/lib/formatters'
import { CategoryIcon } from '@/components/CategoryIcon'
import type { Goal } from '@/types'

interface Props {
  goal: Goal
  onClose: () => void
}

export const GoalAchievedSheet: React.FC<Props> = ({ goal, onClose }) => {
  useEffect(() => {
    haptic.success()
  }, [])

  // v0.34: определение эмодзи иконки (эмодзи или id)
  const isEmojiString = /\p{Extended_Pictographic}/u.test(goal.icon)
  const emoji = isEmojiString ? goal.icon : '🎯'

  return (
    <div
      className="fixed inset-0 z-[200] animate-fadeIn"
      style={{ background: '#000', overflow: 'hidden' }}
    >
      {/* Градиентный фон */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 30% 20%, rgba(0,200,100,0.2), transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,23,68,0.15), transparent 50%)',
      }} />
      {/* Конфетти */}
      <div className="absolute pointer-events-none" style={{ top: 80, left: 40, width: 6, height: 6, background: '#00c864', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ top: 120, right: 60, width: 4, height: 14, background: '#ff1744', borderRadius: 2, transform: 'rotate(30deg)' }} />
      <div className="absolute pointer-events-none" style={{ top: 180, left: 80, width: 8, height: 8, background: '#ffd54f', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ top: 90, right: 100, width: 4, height: 12, background: '#00c864', borderRadius: 2, transform: 'rotate(-20deg)' }} />
      <div className="absolute pointer-events-none" style={{ top: 220, right: 40, width: 6, height: 6, background: '#ff1744', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ top: 260, left: 60, width: 5, height: 5, background: '#8b5cf6', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ bottom: 200, right: 70, width: 8, height: 8, background: '#00c864', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ bottom: 240, left: 50, width: 4, height: 12, background: '#ffd54f', borderRadius: 2, transform: 'rotate(45deg)' }} />

      <div
        className="relative flex flex-col items-center justify-center"
        style={{ minHeight: '100%', padding: '40px 24px' }}
      >
        {/* Большая иконка */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 130, height: 130,
            background: 'rgba(0,200,100,0.15)',
            borderRadius: '50%',
            fontSize: 72,
            border: '2px solid rgba(0,200,100,0.4)',
            boxShadow: '0 0 60px rgba(0,200,100,0.4)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        >
          🎯
        </div>

        <div style={{ color: '#00c864', fontSize: 11, letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginTop: 30 }}>
          Цель достигнута!
        </div>

        <div className="flex items-center" style={{ gap: 10, marginTop: 14 }}>
          <div
            className="flex items-center justify-center"
            style={{ width: 40, height: 40, background: 'rgba(0,200,100,0.15)', borderRadius: 10, fontSize: 22 }}
          >
            {emoji}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 500 }}>
            {goal.name}
          </div>
        </div>

        <div style={{ color: '#00c864', fontSize: 36, fontWeight: 300, marginTop: 14, letterSpacing: '-0.02em' }}>
          {formatMoney(goal.targetAmount, goal.currency)}
        </div>

        {/* Прогресс 100% */}
        <div style={{ width: '100%', maxWidth: 280, height: 6, background: 'rgba(0,200,100,0.15)', borderRadius: 999, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #00c864, #00e07a)', boxShadow: '0 0 12px rgba(0,200,100,0.6)' }} />
        </div>
        <div style={{ color: '#00c864', fontSize: 11, marginTop: 6, fontWeight: 500 }}>
          100% · цель выполнена
        </div>

        <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 22, lineHeight: 1.5, maxWidth: 260 }}>
          Ты накопил, что запланировал.<br/>Теперь можно потратить! 🎉
        </div>

        <div className="flex flex-col" style={{ width: '100%', maxWidth: 300, marginTop: 30, gap: 8 }}>
          <button
            onClick={() => { haptic.light(); onClose() }}
            className="cursor-pointer border-0 active:scale-[0.98] transition-transform"
            style={{
              padding: 14,
              background: '#00c864',
              borderRadius: 14,
              color: '#0a0a0a',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(0,200,100,0.4)',
            }}
          >
            Отлично! 🎉
          </button>
          <button
            onClick={() => { haptic.light(); onClose() }}
            className="cursor-pointer"
            style={{
              padding: 12,
              background: 'transparent',
              border: '0.5px solid #222',
              borderRadius: 14,
              color: '#888',
              fontSize: 12,
            }}
          >
            Оставить как копилку
          </button>
        </div>
      </div>
    </div>
  )
}

// Трекинг какие цели уже показали чтобы не спамить
const STORAGE_KEY = 'goals_achieved_shown'

export const getAchievedShown = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export const markAchievedShown = (goalId: string) => {
  try {
    const shown = getAchievedShown()
    if (!shown.includes(goalId)) {
      shown.push(goalId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shown))
    }
  } catch {}
}
