import { iconById } from '@/lib/icons'

interface Props {
  iconId: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'expense' | 'income' | 'neutral'
  active?: boolean
}

const sizeMap = {
  sm: 'w-9 h-9 text-base',
  md: 'w-11 h-11 text-lg',
  lg: 'w-14 h-14 text-2xl',
}

export const CategoryIcon: React.FC<Props> = ({ iconId, size = 'sm', variant = 'expense', active }) => {
  // Если iconId — это эмодзи-строка (не id), используем напрямую
  const isEmoji = /\p{Extended_Pictographic}/u.test(iconId)
  const displayEmoji = isEmoji ? iconId : iconById(iconId).emoji

  const bgStyle = active
    ? { backgroundColor: 'rgb(var(--c-accent))' }
    : variant === 'income'
    ? { backgroundColor: 'rgba(var(--c-success), 0.15)' }
    : variant === 'neutral'
    ? undefined
    : { backgroundColor: 'rgba(var(--c-accent), 0.12)' }

  return (
    <div
      className={`${sizeMap[size]} rounded-[10px] flex items-center justify-center shrink-0 transition-colors`}
      style={bgStyle}
    >
      <span>{displayEmoji}</span>
    </div>
  )
}
