/**
 * Модалка для подтверждения pending-транзакций из бота.
 * Показывается при запуске если в боте есть неподтверждённые записи.
 */

import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { haptic } from '@/lib/telegram'
import { fetchPendingTxs, removePendingTx, type BotPendingTx } from '@/lib/botPending'
import { CategoryIcon } from '@/components/CategoryIcon'
import { currencySign } from '@/lib/formatters'

// Сопоставление категории от бота с категорией пользователя по имени/эмодзи
const matchCategory = (
  categories: { id: string; name: string; type: 'expense' | 'income'; icon: string }[],
  guess: string,
  type: 'expense' | 'income',
): string | null => {
  const needle = guess.toLowerCase().trim()
  const sameType = categories.filter((c) => c.type === type)
  // Точное совпадение
  let match = sameType.find((c) => c.name.toLowerCase() === needle)
  if (match) return match.id
  // Частичное (одно в другом)
  match = sameType.find((c) => c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase()))
  if (match) return match.id
  return null
}

interface Props {
  onClose: () => void
}

export const BotPendingSheet: React.FC<Props> = ({ onClose }) => {
  const state = useStore()
  const { addTransaction, categories, accounts } = state
  const visibleAccounts = accounts.filter((a) => !a.archived && a.type !== 'goal')

  const [items, setItems] = useState<BotPendingTx[] | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [accountId, setAccountId] = useState<string>(visibleAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPendingTxs().then(async (all) => {
      // v0.58: авто-подтверждённые (нажал «Добавить все» в боте) — материализуем сразу без UI
      const auto = all.filter((t) => t.autoConfirmed)
      const manual = all.filter((t) => !t.autoConfirmed)
      for (const t of auto) {
        const defaultAccount = visibleAccounts[0]
        if (!defaultAccount) continue
        const matched = matchCategory(categories, t.categoryGuess, t.type)
        const fallback = categories.filter((c) => c.type === t.type)[0]?.id
        const catId = matched ?? fallback
        if (!catId) continue
        addTransaction({
          type: t.type,
          amount: t.amount,
          currency: (t.currency as any) || defaultAccount.currency,
          accountId: defaultAccount.id,
          categoryId: catId,
          date: t.date,
          comment: t.comment || t.merchant || undefined,
        })
        await removePendingTx(t.id)
      }
      setItems(manual)
    })
  }, [])

  const current = items && items[activeIdx]

  useEffect(() => {
    if (!current) return
    const matched = matchCategory(categories, current.categoryGuess, current.type)
    if (matched) {
      setCategoryId(matched)
    } else {
      const sameType = categories.filter((c) => c.type === current.type)
      setCategoryId(sameType[0]?.id ?? null)
    }
  }, [current?.id, categories])

  if (!items) return null
  if (items.length === 0) {
    onClose()
    return null
  }
  if (!current) {
    onClose()
    return null
  }

  const account = visibleAccounts.find((a) => a.id === accountId)
  const suitableCategories = categories.filter((c) => c.type === current.type)
  const canSave = account && categoryId && current.amount > 0

  const handleSkip = async () => {
    haptic.light()
    await removePendingTx(current.id)
    const next = items.filter((_, i) => i !== activeIdx)
    if (next.length === 0) { onClose(); return }
    setItems(next)
    setActiveIdx(Math.max(0, activeIdx - 1))
  }

  const handleSave = async () => {
    if (!canSave || !account || !categoryId) return
    setSaving(true)
    haptic.success()
    addTransaction({
      type: current.type,
      amount: current.amount,
      currency: (current.currency as any) || account.currency,
      accountId: account.id,
      categoryId,
      date: current.date,
      comment: current.comment || (current.merchant ? current.merchant : undefined),
    })
    await removePendingTx(current.id)
    const next = items.filter((_, i) => i !== activeIdx)
    setSaving(false)
    if (next.length === 0) { onClose(); return }
    setItems(next)
    setActiveIdx(Math.max(0, activeIdx - 1))
  }

  const sign = current.type === 'expense' ? '−' : '+'
  const sourceIcon = current.source === 'voice' ? '🎤' : '💬'

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 flex items-end z-[80] animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-bg-secondary rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <div className="w-10 h-1 bg-bg-tertiary rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-medium">Из бота</div>
          {items.length > 1 && (
            <div className="text-xs text-text-muted">{activeIdx + 1} / {items.length}</div>
          )}
        </div>

        {/* Карточка транзакции */}
        <div className="bg-bg-tertiary rounded-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs">{sourceIcon}</span>
            <span className="text-xs text-text-muted truncate">{current.rawText}</span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[36px] font-light leading-none ${current.type === 'expense' ? 'text-accent' : 'text-success'}`}>
              {sign}{current.amount.toLocaleString('ru-RU')}
            </span>
            <span className="text-lg text-text-muted">{currencySign((current.currency as any) || 'RUB')}</span>
          </div>
          <div className="text-xs text-text-muted">
            {current.categoryGuess}
            {current.merchant ? ` · ${current.merchant}` : ''}
          </div>
        </div>

        {/* Выбор счёта */}
        <div className="mb-3">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1.5">Счёт</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-x">
            {visibleAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { haptic.select(); setAccountId(a.id) }}
                className={`px-3 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 whitespace-nowrap shrink-0 ${
                  accountId === a.id ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Выбор категории */}
        <div className="mb-4">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1.5">Категория</div>
          <div className="grid grid-cols-5 gap-1.5">
            {suitableCategories.slice(0, 10).map((c) => {
              const active = c.id === categoryId
              return (
                <button
                  key={c.id}
                  onClick={() => { haptic.select(); setCategoryId(c.id) }}
                  className="aspect-square rounded-btn flex flex-col items-center justify-center gap-0.5 cursor-pointer border-0 px-0.5"
                  style={
                    active
                      ? { border: '1.5px solid rgb(var(--c-accent))', backgroundColor: 'rgba(var(--c-accent), 0.08)' }
                      : { backgroundColor: 'rgba(var(--c-accent), 0.06)' }
                  }
                >
                  <CategoryIcon iconId={c.icon} size="sm" variant="neutral" />
                  <span className="text-[8px] font-medium truncate max-w-full">{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-3 bg-bg-tertiary border-0 rounded-btn text-text-secondary text-sm font-medium cursor-pointer"
          >
            Пропустить
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 py-3 rounded-btn text-sm font-medium cursor-pointer border-0 ${
              canSave ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-faint'
            }`}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
