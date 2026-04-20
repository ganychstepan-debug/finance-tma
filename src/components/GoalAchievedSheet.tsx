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

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-fadeIn">
      <div className="w-full max-w-sm bg-bg rounded-2xl p-6 text-center relative overflow-hidden">
        {/* Конфетти-градиент фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-success/20 via-transparent to-accent/20 pointer-events-none" />

        <div className="relative">
          <div className="text-6xl mb-4 animate-bounce">🎯</div>

          <div className="text-xs text-success uppercase tracking-wide mb-1">
            Цель достигнута!
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <CategoryIcon iconId={goal.icon} size="md" />
            <div className="text-xl font-medium text-white">{goal.name}</div>
          </div>

          <div className="text-2xl font-medium text-success mb-4">
            {formatMoney(goal.targetAmount, goal.currency)}
          </div>

          <div className="text-xs text-text-muted leading-relaxed mb-6">
            Ты накопил что запланировал.<br/>
            Теперь можно потратить! 🎉
          </div>

          <button
            onClick={() => { haptic.light(); onClose() }}
            className="w-full py-3 bg-success text-white rounded-btn text-sm font-medium cursor-pointer border-0"
          >
            Отлично!
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
