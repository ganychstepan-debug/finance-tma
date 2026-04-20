import type { Transaction } from '@/types'
import { useStore } from '@/store'
import { CategoryIcon } from './CategoryIcon'
import { formatMoney, formatDate } from '@/lib/formatters'

interface Props {
  tx: Transaction
  showDivider?: boolean
  onClick?: () => void
}

export const TransactionRow: React.FC<Props> = ({ tx, showDivider = true, onClick }) => {
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)

  const category = categories.find((c) => c.id === tx.categoryId)
  const account = accounts.find((a) => a.id === tx.accountId)

  const isIncome = tx.type === 'income'
  const isTransfer = tx.type === 'transfer'

  const title = isTransfer
    ? 'Перевод'
    : category?.name ?? '(без категории)'

  const subtitle = [
    account?.name,
    tx.comment,
    formatDate(tx.date),
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')

  const amountText = isIncome
    ? `+${formatMoney(tx.amount, tx.currency).replace('−', '')}`
    : `−${formatMoney(tx.amount, tx.currency).replace('−', '')}`

  const amountColor = isIncome ? 'text-success' : 'text-accent'

  return (
    <div
      onClick={onClick}
      className={`flex items-center py-2.5 ${showDivider ? 'border-b' : ''} border-border-muted cursor-pointer`}
      style={showDivider ? { borderBottomWidth: '0.5px' } : undefined}
    >
      <div className="mr-3">
        <CategoryIcon
          iconId={category?.icon ?? (isTransfer ? 'wallet' : 'other')}
          size="sm"
          variant={isIncome ? 'income' : 'expense'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-text-muted truncate">{subtitle}</div>
      </div>
      <div className={`text-[14px] font-medium ${amountColor} shrink-0 ml-2`}>
        {amountText}
      </div>
    </div>
  )
}
