import { useState } from 'react'
import { useStore } from '@/store'
import { BUILTIN_CURRENCIES } from '@/types'
import { currencySign } from '@/lib/formatters'
import { haptic } from '@/lib/telegram'
import { BackButton } from '@/components/BackButton'

interface Props {
  onClose: () => void
}

export const CurrencyScreen: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings, addCustomCurrency, removeCustomCurrency } = useStore()
  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [error, setError] = useState('')

  const allCurrencies = [...BUILTIN_CURRENCIES, ...settings.customCurrencies]

  const choose = (code: string) => {
    haptic.select()
    updateSettings({ baseCurrency: code })
  }

  const handleAdd = () => {
    const normalized = newCode.trim().toUpperCase()
    if (!/^[A-Z]{2,4}$/.test(normalized)) {
      setError('Код валюты — 2–4 латинские буквы (AED, GEL, TRY и т.д.)')
      haptic.error()
      return
    }
    if (allCurrencies.includes(normalized)) {
      setError('Такая валюта уже есть')
      haptic.error()
      return
    }
    haptic.success()
    addCustomCurrency(normalized)
    setNewCode('')
    setError('')
    setAdding(false)
  }

  const handleRemove = (code: string) => {
    if (!window.confirm(`Удалить валюту ${code}?\nСчета с этой валютой останутся, но не смогут быть выбраны для новых.`)) return
    haptic.warning()
    removeCustomCurrency(code)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Основная валюта</div>
        <div className="w-12" />
      </div>

      <div className="px-5 pt-4 pb-4">
        <div className="text-xs text-text-muted mb-3">
          В этой валюте отображается общий баланс на главном экране.
        </div>

        <div className="text-2xs text-text-muted uppercase tracking-wide mb-2">Стандартные</div>
        <div className="space-y-1.5 mb-5">
          {BUILTIN_CURRENCIES.map((c) => (
            <CurrencyRow
              key={c}
              code={c}
              isActive={settings.baseCurrency === c}
              onClick={() => choose(c)}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mb-2">
          <div className="text-2xs text-text-muted uppercase tracking-wide">Свои валюты</div>
          {!adding && (
            <button
              onClick={() => { haptic.light(); setAdding(true) }}
              className="text-xs text-accent bg-transparent border-0 cursor-pointer"
            >
              + Добавить
            </button>
          )}
        </div>

        {adding && (
          <div className="p-3.5 bg-bg-secondary border border-border rounded-card mb-3 animate-slide-up">
            <input
              type="text"
              autoFocus
              value={newCode}
              onChange={(e) => { setNewCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="Например, AED или GEL"
              maxLength={4}
              className="w-full px-3 py-2.5 bg-bg-tertiary border-0 rounded-btn text-white text-sm box-border uppercase"
            />
            {error && <div className="text-xs text-accent mt-2">{error}</div>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setAdding(false); setNewCode(''); setError('') }}
                className="flex-1 py-2.5 bg-transparent border border-border rounded-btn text-text-muted text-sm cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2.5 bg-accent border-0 rounded-btn text-white text-sm font-medium cursor-pointer"
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {settings.customCurrencies.length === 0 && !adding && (
            <div className="text-xs text-text-muted py-3">
              Не хватает валюты? Добавь любой трёхбуквенный код (ISO 4217).
            </div>
          )}
          {settings.customCurrencies.map((c) => (
            <CurrencyRow
              key={c}
              code={c}
              isActive={settings.baseCurrency === c}
              onClick={() => choose(c)}
              onRemove={() => handleRemove(c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const CurrencyRow: React.FC<{
  code: string
  isActive: boolean
  onClick: () => void
  onRemove?: () => void
}> = ({ code, isActive, onClick, onRemove }) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-btn border transition-colors ${
      isActive
        ? 'bg-accent/15 border-accent/40'
        : 'bg-bg-secondary border-border'
    }`}
  >
    <button
      onClick={onClick}
      className="flex items-center gap-3 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left p-0"
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-medium shrink-0 ${
          isActive ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-primary'
        }`}
      >
        {currencySign(code)}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{code}</div>
      </div>
      {isActive && <div className="text-accent text-sm">✓</div>}
    </button>
    {onRemove && !isActive && (
      <button
        onClick={onRemove}
        className="text-text-muted text-xs bg-transparent border-0 cursor-pointer px-2 py-1"
        aria-label="Удалить"
      >
        ✕
      </button>
    )}
  </div>
)
