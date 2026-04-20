import { useState } from 'react'
import { useStore } from '@/store'
import { BANKS } from '@/lib/icons'
import { BankIcon } from '@/components/BankIcons'
import { haptic } from '@/lib/telegram'
import { BUILTIN_CURRENCIES } from '@/types'
import type { AccountType, Currency } from '@/types'
import { BackButton } from '@/components/BackButton'

interface Props {
  editId?: string
  onClose: () => void
  onDone: () => void
}

const TYPES: { id: AccountType; label: string; emoji: string }[] = [
  { id: 'card',    label: 'Карта',    emoji: '💳' },
  { id: 'cash',    label: 'Наличные', emoji: '💵' },
  { id: 'deposit', label: 'Вклад',    emoji: '🏦' },
]

const CUSTOM_BANK_COLORS = [
  '#ff1744', '#00c864', '#0a84ff', '#ffcc00',
  '#af52de', '#ff9500', '#5ac8fa', '#8e8e93',
]

export const AccountEditScreen: React.FC<Props> = ({ editId, onClose, onDone }) => {
  const { accounts, settings, addAccount, updateAccount, deleteAccount, addCustomBank, removeCustomBank } = useStore()
  const existing = editId ? accounts.find((a) => a.id === editId) : undefined

  // Валюты: встроенные + пользовательские
  const availableCurrencies: Currency[] = [...BUILTIN_CURRENCIES, ...settings.customCurrencies]
  const customBanks = settings.customBanks ?? []
  const allBanks = [...BANKS.filter((b) => b.id !== 'other'), ...customBanks, BANKS.find((b) => b.id === 'other')!]

  const [name, setName]       = useState(existing?.name ?? '')
  const [type, setType]       = useState<AccountType>(existing?.type ?? 'card')
  const [bankId, setBankId]   = useState(existing?.bankId ?? 'tinkoff')
  const [balance, setBalance] = useState(String(existing?.balance ?? ''))
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? settings.baseCurrency)
  const [includeInTotal, setIncludeInTotal] = useState(existing?.includeInTotal ?? true)

  const [showBankCreator, setShowBankCreator] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newBankColor, setNewBankColor] = useState(CUSTOM_BANK_COLORS[0])

  const handleCreateBank = () => {
    // v0.34: буквы автогенерируются из названия (первые 1-2 символа)
    const autoLetters = newBankName.trim().slice(0, 2).toUpperCase()
    const id = addCustomBank(newBankName, autoLetters || newBankName.charAt(0), newBankColor)
    if (!id) {
      alert('Можно добавить максимум 5 своих банков.')
      return
    }
    haptic.success()
    setBankId(id)
    setShowBankCreator(false)
    setNewBankName('')
  }

  const handleDeleteCustomBank = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Удалить этот банк из списка?')) return
    removeCustomBank(id)
    if (bankId === id) setBankId('tinkoff')
    haptic.medium()
  }

  const canSave = name.trim().length > 0 && !isNaN(Number(balance))

  const save = () => {
    if (!canSave) return
    haptic.success()
    const data = {
      name: name.trim(),
      type,
      bankId: type === 'card' ? bankId : undefined,
      balance: Number(balance) || 0,
      currency,
      icon: type,
      includeInTotal,
      archived: false,
    }
    if (editId) updateAccount(editId, data)
    else addAccount(data)
    onDone()
  }

  const handleDelete = () => {
    if (!editId) return
    if (!window.confirm('Удалить счёт и все его транзакции?')) return
    haptic.warning()
    deleteAccount(editId)
    onDone()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">{editId ? 'Счёт' : 'Новый счёт'}</div>
        <button
          onClick={save}
          disabled={!canSave}
          className={`bg-transparent border-0 cursor-pointer text-base ${canSave ? 'text-accent' : 'text-text-faint'}`}
        >
          Готово
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 pb-8">
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Название</label>
          <input
            type="text"
            placeholder="Например, Тинькофф Блэк"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
          />
        </div>

        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Тип счёта</label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { haptic.select(); setType(t.id) }}
                className={`aspect-square rounded-btn border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  type === t.id ? 'bg-accent border-0 text-white' : 'bg-bg-secondary border-border text-text-secondary'
                }`}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
            <button
              onClick={() => { haptic.light(); alert('Свой тип счёта — скоро. Брокер, крипто, вклад на ребёнка.') }}
              className="aspect-square rounded-btn bg-transparent flex flex-col items-center justify-center gap-1 cursor-pointer text-accent"
              style={{ border: '1px dashed rgba(var(--c-border), 1)' }}
            >
              <span className="text-xl font-light leading-none">+</span>
              <span className="text-[10px] font-medium">Свой</span>
            </button>
          </div>
        </div>

        {type === 'card' && (
          <div>
            <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Банк</label>
            <div className="grid grid-cols-5 gap-2">
              {allBanks.map((b) => {
                const isCustom = b.id.startsWith('custom_')
                return (
                  <div key={b.id} className="relative">
                    <button
                      onClick={() => { haptic.select(); setBankId(b.id) }}
                      className={`w-full aspect-square rounded-btn flex items-center justify-center cursor-pointer bg-bg-secondary border ${
                        bankId === b.id ? 'border-accent' : 'border-border'
                      }`}
                      style={{ borderWidth: bankId === b.id ? '2px' : '0.5px' }}
                      title={b.name}
                    >
                      <BankIcon bankId={b.id} size={36} />
                    </button>
                    {isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustomBank(b.id, e)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg-tertiary border border-border text-text-muted text-[10px] cursor-pointer flex items-center justify-center"
                        aria-label="Удалить банк"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {customBanks.length < 5 && (
                <button
                  onClick={() => { haptic.light(); setShowBankCreator(true) }}
                  className="aspect-square rounded-btn flex items-center justify-center cursor-pointer bg-transparent border border-dashed border-border text-text-muted text-2xl"
                  title="Добавить свой банк"
                >
                  +
                </button>
              )}
            </div>
            {customBanks.length > 0 && (
              <div className="text-[10px] text-text-muted mt-1.5">
                Своих банков: {customBanks.length} / 5
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Текущий баланс</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-2xs text-text-muted uppercase tracking-wide">Валюта</label>
            <span className="text-[10px] text-text-muted">
              Нет нужной? Добавь в меню → Основная валюта
            </span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {availableCurrencies.map((c) => (
              <button
                key={c}
                onClick={() => { haptic.select(); setCurrency(c) }}
                className={`py-2.5 rounded-btn text-xs font-medium cursor-pointer border ${
                  currency === c
                    ? 'bg-accent border-0 text-white'
                    : 'bg-bg-secondary border-border text-text-secondary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-bg-secondary border border-border rounded-btn flex justify-between items-center">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Учитывать в общем балансе</div>
            <div className="text-xs text-text-muted mt-0.5">Сумма на главном экране</div>
          </div>
          <button
            onClick={() => { haptic.select(); setIncludeInTotal(!includeInTotal) }}
            className={`relative w-10 h-6 rounded-full cursor-pointer border-0 transition-colors shrink-0 ${
              includeInTotal ? 'bg-accent' : 'bg-bg-tertiary'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                includeInTotal ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {editId && (
          <button
            onClick={handleDelete}
            className="w-full py-3 bg-transparent border border-accent/50 rounded-btn text-accent text-sm font-medium cursor-pointer"
          >
            Удалить счёт
          </button>
        )}
      </div>

      {/* Модалка создания своего банка */}
      {showBankCreator && (
        <div
          onClick={() => setShowBankCreator(false)}
          className="fixed inset-0 bg-black/70 flex items-end z-[70]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-secondary rounded-t-3xl px-5 pt-5 pb-8"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            <div className="w-10 h-1 bg-bg-tertiary rounded-full mx-auto mb-4" />
            <div className="text-base font-medium text-center mb-5">Свой банк</div>

            <div className="flex justify-center mb-5">
              <div
                className="w-16 h-16 rounded-[14px] flex items-center justify-center text-white text-2xl font-semibold"
                style={{ background: newBankColor }}
              >
                {(newBankName.trim().slice(0, 2) || '?').toUpperCase()}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-2xs text-text-muted uppercase tracking-wide block mb-1.5">Название</label>
                <input
                  type="text"
                  placeholder="Например, ЮMoney"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  maxLength={30}
                  className="w-full px-3.5 py-3 bg-bg-tertiary border-0 rounded-btn text-white text-sm box-border"
                />
                <div className="text-[11px] text-text-muted mt-1.5">Буквы подберутся автоматически</div>
              </div>

              <div>
                <label className="text-2xs text-text-muted uppercase tracking-wide block mb-1.5">Цвет</label>
                <div className="flex gap-2">
                  {CUSTOM_BANK_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { haptic.select(); setNewBankColor(c) }}
                      className="flex-1 aspect-square rounded-btn cursor-pointer border-0"
                      style={{
                        background: c,
                        outline: newBankColor === c ? '2px solid #fff' : 'none',
                        outlineOffset: newBankColor === c ? '2px' : '0',
                      }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateBank}
              disabled={!newBankName.trim()}
              className={`w-full mt-5 py-3 rounded-btn text-sm font-medium cursor-pointer border-0 ${
                newBankName.trim() ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-faint'
              }`}
            >
              Добавить
            </button>
            <button
              onClick={() => setShowBankCreator(false)}
              className="w-full mt-2 py-3 bg-transparent border-0 text-text-muted text-sm cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
