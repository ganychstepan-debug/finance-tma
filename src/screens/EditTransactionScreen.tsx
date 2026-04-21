import { useState, useMemo } from 'react'
import { useStore, selectCategoriesByUsage } from '@/store'
import { NumPad } from '@/components/NumPad'
import { CategoryIcon } from '@/components/CategoryIcon'
import { BackButton } from '@/components/BackButton'
import { haptic } from '@/lib/telegram'
import { currencySign } from '@/lib/formatters'
import type { Category } from '@/types'

const MONTHS_LONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const formatDateLong = (d: Date): string => {
  const today = new Date()
  const sameYear = d.getFullYear() === today.getFullYear()
  const daysDiff = Math.floor((today.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
  if (daysDiff === 0) return 'Сегодня'
  if (daysDiff === 1) return 'Вчера'
  const dd = d.getDate()
  const mm = MONTHS_LONG[d.getMonth()]
  return sameYear ? `${dd} ${mm}` : `${dd} ${mm} ${d.getFullYear()}`
}
const toInputDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Props {
  txId: string
  onClose: () => void
  onDone: () => void
}

export const EditTransactionScreen: React.FC<Props> = ({ txId, onClose, onDone }) => {
  const state = useStore()
  const { transactions, accounts, updateTransaction, deleteTransaction } = state
  const tx = transactions.find((t) => t.id === txId)

  // Категории отсортированы по частоте использования — только для expense/income.
  // Для transfer категорий нет, но хук useMemo всегда должен быть в одном месте,
  // поэтому вызываем безусловно, а фоллбэк 'expense' неважен если tx.type === 'transfer'.
  const txType = tx?.type === 'transfer' ? 'expense' : (tx?.type ?? 'expense')
  const visibleCategories = useMemo(
    () => selectCategoriesByUsage(state, txType),
    [state.transactions, state.categories, txType]
  )

  if (!tx) {
    return (
      <div className="flex flex-col h-full p-5">
        <div className="flex justify-between items-center mb-6">
          <BackButton onClick={onClose} />
          <div className="text-base font-medium">Операция не найдена</div>
          <div className="w-12" />
        </div>
      </div>
    )
  }

  const visibleAccounts = accounts.filter((a) => !a.archived)

  const [amount, setAmount]       = useState(String(tx.amount))
  const [accountId, setAccountId] = useState(tx.accountId)
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? '')
  const [comment, setComment]     = useState(tx.comment ?? '')
  const [txDate, setTxDate]       = useState(new Date(tx.date))
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const account = visibleAccounts.find((a) => a.id === accountId)
  const amountNum = Number(amount)
  const canSave = amountNum > 0 && Boolean(accountId) && (tx.type === 'transfer' || Boolean(categoryId))

  const save = () => {
    if (!canSave) return
    haptic.success()
    updateTransaction(txId, {
      amount: amountNum,
      currency: account?.currency ?? tx.currency,
      accountId,
      categoryId: tx.type === 'transfer' ? undefined : categoryId,
      date: txDate.toISOString(),
      comment: comment.trim() || undefined,
    })
    onDone()
  }

  const handleDelete = () => {
    if (!window.confirm('Удалить эту операцию? Баланс счёта будет пересчитан.')) return
    haptic.warning()
    deleteTransaction(txId)
    onDone()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">
          {tx.type === 'expense' ? 'Расход' : tx.type === 'income' ? 'Доход' : 'Перевод'}
        </div>
        <div className="w-16" />
      </div>

      {/* Сумма */}
      <div className="px-5 pt-4 pb-3 text-center">
        <div className="text-[48px] font-light tracking-tight leading-none">
          <span className={tx.type === 'expense' ? 'text-accent' : 'text-success'}>
            {tx.type === 'expense' ? '−' : '+'}
          </span>
          <span className={amountNum === 0 ? 'text-text-muted' : ''}>{amount}</span>
          <span className="text-text-muted text-[32px]"> {currencySign(account?.currency ?? tx.currency)}</span>
        </div>
        <button
          onClick={() => { haptic.select(); setShowAccountPicker(true) }}
          className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-text-muted bg-transparent border-0 cursor-pointer"
        >
          <span>{tx.type === 'expense' ? 'из' : 'на'}</span>
          <span className="text-accent">{account?.name ?? '—'}</span>
          <span>▾</span>
        </button>
      </div>

      {/* Категории — только для expense/income */}
      {tx.type !== 'transfer' && (
        <div className="px-5 pb-3.5">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-2.5">Категория</div>
          <div className="grid grid-cols-4 gap-2">
            {visibleCategories.slice(0, 7).map((c) => (
              <CategoryButton
                key={c.id}
                category={c}
                active={c.id === categoryId}
                onClick={() => { haptic.select(); setCategoryId(c.id) }}
              />
            ))}
            <button
              onClick={() => { haptic.select(); setShowCategoryPicker(true) }}
              className="aspect-square bg-bg-secondary border border-border rounded-btn flex flex-col items-center justify-center gap-1 text-accent cursor-pointer"
            >
              <span className="text-lg font-light">⋯</span>
              <span className="text-[9px]">Ещё</span>
            </button>
          </div>
        </div>
      )}

      {/* Комментарий */}
      <div className="px-5 pb-3.5">
        <textarea
          placeholder="Комментарий (не обязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={300}
          rows={comment.length > 60 ? 3 : 1}
          className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border resize-none"
          style={{ minHeight: 44, fontFamily: 'inherit' }}
        />
      </div>

      {/* Дата */}
      <div className="px-5 pb-3.5">
        <button
          onClick={() => { haptic.select(); setShowDatePicker(true) }}
          className="w-full px-3.5 py-3.5 bg-bg-secondary border border-border rounded-btn flex justify-between items-center cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <span>📅</span>
            <span className="text-sm">{formatDateLong(txDate)}</span>
          </div>
          <span className="text-text-muted text-xs">▾</span>
        </button>
      </div>

      {/* Клавиатура */}
      <div className="px-5 pb-3">
        <NumPad value={amount} onChange={setAmount} />
      </div>

      {/* Удалить */}
      <div className="px-5 pb-6">
        <button
          onClick={handleDelete}
          className="w-full py-3 bg-transparent border border-accent/50 rounded-btn text-accent text-sm font-medium cursor-pointer"
        >
          Удалить операцию
        </button>
      </div>

      {/* Модалки */}
      {showAccountPicker && (
        <div onClick={() => setShowAccountPicker(false)} className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up max-h-[70vh] overflow-y-auto">
            <div className="text-sm font-medium mb-3">Выбрать счёт</div>
            {visibleAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { haptic.select(); setAccountId(a.id); setShowAccountPicker(false) }}
                className={`w-full flex justify-between items-center py-3 px-3 rounded-btn cursor-pointer border-0 text-left mb-1 ${
                  a.id === accountId ? 'bg-accent/15 text-accent' : 'bg-transparent text-white'
                }`}
              >
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-text-muted">
                  {Math.round(a.balance).toLocaleString('ru-RU')} {currencySign(a.currency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCategoryPicker && (
        <div onClick={() => setShowCategoryPicker(false)} className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up max-h-[75vh] overflow-y-auto">
            <div className="text-sm font-medium mb-3">Все категории</div>
            <div className="grid grid-cols-4 gap-2">
              {visibleCategories.map((c) => (
                <CategoryButton
                  key={c.id}
                  category={c}
                  active={c.id === categoryId}
                  onClick={() => { haptic.select(); setCategoryId(c.id); setShowCategoryPicker(false) }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showDatePicker && (
        <div onClick={() => setShowDatePicker(false)} className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up">
            <div className="text-sm font-medium mb-4">Дата операции</div>
            <div className="flex gap-2 mb-4">
              {[{ label: 'Сегодня', days: 0 }, { label: 'Вчера', days: 1 }, { label: '2 дня', days: 2 }, { label: 'Неделя', days: 7 }].map((q) => (
                <button
                  key={q.days}
                  onClick={() => {
                    haptic.select()
                    const d = new Date()
                    d.setDate(d.getDate() - q.days)
                    setTxDate(d)
                  }}
                  className="flex-1 py-2 bg-bg-tertiary border-0 rounded-btn text-xs text-text-secondary cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <label className="block mb-4">
              <div className="text-2xs text-text-muted uppercase tracking-wide mb-2">Точная дата</div>
              <input
                type="date"
                value={toInputDate(txDate)}
                min="2000-01-01"
                max={toInputDate(new Date())}
                onChange={(e) => {
                  if (!e.target.value) return
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  setTxDate(new Date(y, m - 1, d))
                }}
                className="w-full px-3.5 py-3 bg-bg-tertiary border-0 rounded-btn text-white text-sm box-border"
                style={{ colorScheme: 'dark' }}
              />
            </label>
            <button
              onClick={() => { haptic.success(); setShowDatePicker(false) }}
              className="w-full py-3 bg-accent border-0 rounded-btn text-white text-sm font-medium cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const CategoryButton: React.FC<{
  category: Category
  active: boolean
  onClick: () => void
}> = ({ category, active, onClick }) => (
  <button
    onClick={onClick}
    className={`aspect-square rounded-btn flex flex-col items-center justify-center gap-1 cursor-pointer border ${
      active ? 'bg-accent border-0 text-white' : 'bg-bg-secondary border-border text-text-secondary'
    }`}
  >
    <CategoryIcon iconId={category.icon} size="sm" variant={active ? 'neutral' : 'expense'} />
    <span className="text-[9px] font-medium truncate max-w-full px-1">{category.name}</span>
  </button>
)
