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

      <div className="px-4 pt-4 pb-10">
        <div style={{ color: '#888', fontSize: 11, lineHeight: 1.5, marginBottom: 14 }}>
          В этой валюте отображается общий баланс на главном экране.
        </div>

        <div
          className="mb-2"
          style={{ color: '#666', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}
        >
          Стандартные
        </div>
        <div className="flex flex-col mb-5" style={{ gap: 5 }}>
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
          <div style={{ color: '#666', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}>
            Свои валюты
          </div>
          {!adding && (
            <button
              onClick={() => { haptic.light(); setAdding(true) }}
              className="bg-transparent border-0 cursor-pointer"
              style={{ color: '#ff1744', fontSize: 11 }}
            >
              + Добавить
            </button>
          )}
        </div>

        {adding && (
          <div
            className="animate-slide-up mb-2.5"
            style={{
              padding: 12,
              background: '#141414',
              border: '0.5px solid #222',
              borderRadius: 14,
            }}
          >
            <input
              type="text"
              autoFocus
              value={newCode}
              onChange={(e) => { setNewCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="Например, AED или GEL"
              maxLength={4}
              className="w-full border-0 box-border uppercase"
              style={{
                padding: '10px 13px',
                background: '#1f1f1f',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                letterSpacing: '0.05em',
                marginBottom: 10,
              }}
            />
            {error && <div style={{ color: '#ff1744', fontSize: 11, marginTop: -6, marginBottom: 8 }}>{error}</div>}
            <div className="flex" style={{ gap: 6 }}>
              <button
                onClick={() => { setAdding(false); setNewCode(''); setError('') }}
                className="flex-1 bg-transparent cursor-pointer"
                style={{
                  padding: '9px 0',
                  border: '0.5px solid #222',
                  borderRadius: 10,
                  color: '#888',
                  fontSize: 11,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 border-0 cursor-pointer"
                style={{
                  padding: '9px 0',
                  background: '#ff1744',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col" style={{ gap: 5 }}>
          {settings.customCurrencies.length === 0 && !adding && (
            <div style={{ color: '#666', fontSize: 11, padding: '12px 0' }}>
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
    className="flex items-center"
    style={{
      padding: 10,
      gap: 10,
      background: isActive ? 'rgba(255,23,68,0.15)' : '#141414',
      border: isActive ? '0.5px solid rgba(255,23,68,0.4)' : '0.5px solid #222',
      borderRadius: 10,
    }}
  >
    <button
      onClick={onClick}
      className="flex items-center flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left p-0"
      style={{ gap: 10 }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 36, height: 36,
          borderRadius: 8,
          background: isActive ? '#ff1744' : '#1f1f1f',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {currencySign(code)}
      </div>
      <div className="flex-1">
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{code}</div>
      </div>
      {isActive && <div style={{ color: '#ff1744', fontSize: 13 }}>✓</div>}
    </button>
    {onRemove && !isActive && (
      <button
        onClick={onRemove}
        className="bg-transparent border-0 cursor-pointer"
        style={{ color: '#666', fontSize: 14, padding: '0 4px' }}
        aria-label="Удалить"
      >
        ✕
      </button>
    )}
  </div>
)
