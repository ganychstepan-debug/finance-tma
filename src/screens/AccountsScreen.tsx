import { useStore } from '@/store'
import { bankById } from '@/lib/icons'
import { BankIcon } from '@/components/BankIcons'
import { formatMoney } from '@/lib/formatters'
import { haptic } from '@/lib/telegram'
import type { Account, AccountType } from '@/types'

interface Props {
  onClose: () => void
  onAddNew: () => void
  onEdit: (id: string) => void
}

const GROUP_ORDER: { id: AccountType; label: string; emoji: string }[] = [
  { id: 'card',    label: 'Карты',    emoji: '💳' },
  { id: 'cash',    label: 'Наличные', emoji: '💵' },
  { id: 'deposit', label: 'Вклады',   emoji: '🏦' },
  { id: 'wallet',  label: 'Кошельки', emoji: '👛' },
]

export const AccountsScreen: React.FC<Props> = ({ onClose, onAddNew, onEdit }) => {
  const { accounts, toggleInTotal, settings } = useStore()
  const visible = accounts.filter((a) => !a.archived && a.type !== 'goal')

  const grouped: Record<string, Account[]> = {}
  for (const g of GROUP_ORDER) grouped[g.id] = []
  for (const a of visible) {
    if (grouped[a.type]) grouped[a.type].push(a)
  }

  // v0.34: общий баланс и сумма по группам
  const totalBalance = visible
    .filter((a) => a.includeInTotal)
    .reduce((sum, a) => sum + a.balance, 0)
  const activeCount = visible.filter((a) => a.includeInTotal).length

  const groupSum = (items: Account[]): number =>
    items.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <button onClick={onClose} className="text-text-secondary bg-transparent border-0 cursor-pointer text-base">
          ←
        </button>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Счета</div>
        <button
          onClick={onAddNew}
          className="bg-transparent border-0 cursor-pointer"
          style={{ color: '#ff1744', fontSize: 13, fontWeight: 500 }}
        >
          + Добавить
        </button>
      </div>

      {/* v0.34: общий баланс */}
      {visible.length > 0 && (
        <div className="px-5 pt-2">
          <div
            style={{
              padding: 14,
              background: '#141414',
              border: '0.5px solid #222',
              borderRadius: 14,
              textAlign: 'center',
            }}
          >
            <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500 }}>
              ОБЩИЙ БАЛАНС
            </div>
            <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, marginTop: 4 }}>
              <span style={{ color: '#ff1744' }}>₽ </span>
              {Math.round(totalBalance).toLocaleString('ru-RU')}
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
              {activeCount} активн{activeCount === 1 ? 'ый' : activeCount < 5 ? 'ых' : 'ых'} счёт{activeCount === 1 ? '' : activeCount < 5 ? 'а' : 'ов'}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 py-3 space-y-5">
        {visible.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">💳</div>
            <div className="text-sm text-text-secondary mb-4">
              У тебя пока нет счетов
            </div>
            <button
              onClick={onAddNew}
              className="px-6 py-3 bg-accent border-0 rounded-btn text-white text-sm font-medium cursor-pointer"
            >
              Добавить первый
            </button>
          </div>
        ) : (
          GROUP_ORDER.map((g) => {
            const items = grouped[g.id]
            if (items.length === 0) return null
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{g.emoji}</span>
                    <span className="text-2xs uppercase tracking-wide" style={{ color: '#888', letterSpacing: '1px', fontWeight: 600 }}>
                      {g.label}
                    </span>
                  </div>
                  <span className="text-2xs" style={{ color: '#555' }}>
                    {Math.round(groupSum(items)).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((a) => {
                    const bank = a.type === 'card' ? bankById(a.bankId, settings.customBanks) : null
                    const emoji = a.type === 'cash' ? '💵' : a.type === 'deposit' ? '🏦' : '👛'
                    return (
                      <div
                        key={a.id}
                        className="p-3.5 bg-bg-secondary border border-border rounded-card flex items-center gap-3"
                      >
                        <div
                          onClick={() => onEdit(a.id)}
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          {bank ? (
                            <BankIcon bankId={bank.id} size={40} className="shrink-0" customBanks={settings.customBanks} />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center text-lg shrink-0">
                              {emoji}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{a.name}</div>
                            <div className="text-xs text-text-muted">{formatMoney(a.balance, a.currency)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => { haptic.select(); toggleInTotal(a.id) }}
                          className={`relative w-10 h-6 rounded-full cursor-pointer border-0 transition-colors shrink-0 ${
                            a.includeInTotal ? 'bg-accent' : 'bg-bg-tertiary'
                          }`}
                          title={a.includeInTotal ? 'В общем балансе' : 'Не в общем балансе'}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                              a.includeInTotal ? 'translate-x-[18px]' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
