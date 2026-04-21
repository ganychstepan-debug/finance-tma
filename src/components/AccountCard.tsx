import type { Account } from '@/types'
import { bankById } from '@/lib/icons'
import { formatMoney } from '@/lib/formatters'
import { useStore } from '@/store'

interface Props {
  account: Account
  onClick?: () => void
}

// v0.34: карточка счёта 128px, компактная
export const AccountCard: React.FC<Props> = ({ account, onClick }) => {
  const customBanks = useStore((s) => s.settings.customBanks ?? [])
  const bank = account.type === 'card' ? bankById(account.bankId, customBanks) : null
  const isActive = account.includeInTotal
  const isHidden = !isActive

  const renderIcon = () => {
    if (bank && account.type === 'card') {
      const bankColor = bank.color || '#1f1f1f'
      // Авто-определение контраста: жёлтые банки - чёрная буква
      const isLightBg = ['#FFDD2D', '#FEE600', '#FFCC00'].includes(bankColor.toUpperCase())
      const textColor = isLightBg ? '#1a1a1a' : '#fff'
      const letter = (bank.short || bank.name.charAt(0)).toUpperCase()
      return (
        <div
          className="flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            background: bankColor,
            borderRadius: 8,
            boxShadow: isActive ? `0 2px 8px ${hexToRgba(bankColor, 0.25)}` : undefined,
          }}
        >
          <span style={{ color: textColor, fontSize: 17, fontWeight: 800 }}>
            {letter}
          </span>
        </div>
      )
    }
    const emoji = account.type === 'cash' ? '💵'
      : account.type === 'deposit' ? '🏦'
      : account.type === 'goal' ? (account.icon || '🎯')
      : '📊'
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: 30, height: 30, background: '#1f1f1f', borderRadius: 8, fontSize: 15 }}
      >
        {emoji}
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className="text-left cursor-pointer relative flex-shrink-0"
      style={{
        minWidth: 128,
        padding: '11px 12px',
        background: isActive
          ? 'linear-gradient(135deg, rgba(255,23,68,0.18), rgba(255,23,68,0.05))'
          : '#141414',
        border: isActive ? '0.5px solid rgba(255,23,68,0.5)' : '0.5px solid #222',
        borderRadius: 14,
        opacity: isHidden ? 0.55 : 1,
      }}
    >
      {isActive && (
        <div
          className="absolute"
          style={{
            top: 8, right: 8, width: 6, height: 6, borderRadius: '50%',
            background: '#ff1744',
            boxShadow: '0 0 8px #ff1744, 0 0 14px rgba(255,23,68,0.5)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        />
      )}

      {isHidden && (
        <div className="absolute" style={{ top: 8, right: 8 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>{renderIcon()}</div>

      <div className="truncate" style={{
        color: isActive ? '#fff' : '#ddd',
        fontSize: 12, fontWeight: 500, marginBottom: 2,
      }}>
        {account.name}
      </div>
      <div style={{
        color: isActive ? '#fff' : '#aaa',
        fontSize: 15,
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
      }}>
        {formatMoney(account.balance, account.currency)}
      </div>
    </button>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
