import type { Account } from '@/types'
import { bankById } from '@/lib/icons'
import { BankIcon } from './BankIcons'
import { formatMoney } from '@/lib/formatters'

interface Props {
  account: Account
  onClick?: () => void
}

export const AccountCard: React.FC<Props> = ({ account, onClick }) => {
  const bank = account.type === 'card' ? bankById(account.bankId) : null
  const isActive = account.includeInTotal

  const renderIcon = () => {
    if (bank && account.type === 'card') {
      return (
        <div
          style={isActive ? { boxShadow: '0 2px 8px rgba(255,221,45,0.15), 0 0 0 0.5px rgba(255,255,255,0.05)' } : undefined}
          className="rounded-md"
        >
          <BankIcon bankId={bank.id} size={28} />
        </div>
      )
    }
    const emoji = account.type === 'cash' ? '💵'
      : account.type === 'deposit' ? '🏦'
      : account.type === 'goal' ? (account.icon || '🎯')
      : '👛'
    return (
      <div className="w-7 h-7 rounded-md bg-bg-tertiary flex items-center justify-center text-sm">
        {emoji}
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`min-w-[150px] p-3.5 rounded-card text-left transition-colors cursor-pointer ${
        isActive
          ? 'text-left'
          : 'bg-bg-secondary border border-border'
      }`}
      style={
        isActive
          ? {
              background: 'linear-gradient(135deg, rgba(255,23,68,0.18), rgba(255,23,68,0.05))',
              border: '0.5px solid rgba(255,23,68,0.5)',
            }
          : { borderWidth: '0.5px' }
      }
    >
      <div className="flex justify-between items-center mb-4">
        {renderIcon()}
        {isActive ? (
          <div
            className="w-1.5 h-1.5 rounded-full bg-accent"
            style={{
              boxShadow: '0 0 8px rgb(var(--c-accent-glow-strong)), 0 0 14px rgba(var(--c-accent-glow-strong), 0.5)',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }}
          />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted" aria-label="Не в общем балансе">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        )}
      </div>
      <div className="text-2xs text-text-secondary uppercase tracking-wide truncate font-medium">
        {account.name}
      </div>
      <div className={`text-[17px] font-medium mt-0.5 ${account.balance < 0 ? 'text-accent' : 'text-text-primary'}`}>
        {formatMoney(account.balance, account.currency)}
      </div>
    </button>
  )
}
