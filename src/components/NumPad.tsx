import { haptic } from '@/lib/telegram'

interface Props {
  value: string
  onChange: (next: string) => void
}

// Ввод целых чисел с одной десятичной точкой.
// Максимум 9 цифр до точки, 2 после.

export const NumPad: React.FC<Props> = ({ value, onChange }) => {
  const press = (key: string) => {
    haptic.light()

    if (key === '⌫') {
      onChange(value.length <= 1 ? '0' : value.slice(0, -1))
      return
    }

    if (key === '.') {
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }

    // Цифра
    const next = value === '0' ? key : value + key
    // Проверяем формат
    const parts = next.split('.')
    if (parts[0].length > 9) return
    if (parts[1] && parts[1].length > 2) return

    onChange(next)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  return (
    <div className="grid grid-cols-3 gap-1.5 bg-bg-secondary rounded-card p-2.5">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className={`py-3.5 bg-transparent border-0 cursor-pointer text-[22px] font-light active:bg-bg-tertiary rounded-lg transition-colors ${
            k === '.' ? 'text-text-muted' : k === '⌫' ? 'text-accent text-lg' : 'text-text-primary'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  )
}
