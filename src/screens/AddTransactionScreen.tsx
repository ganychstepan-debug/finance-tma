import { useState, useMemo, useRef } from 'react'
import { useStore, selectCategoriesByUsage } from '@/store'
import { bankById } from '@/lib/icons'
import { NumPad } from '@/components/NumPad'
import { CategoryIcon } from '@/components/CategoryIcon'
import { BackButton } from '@/components/BackButton'
import { SwipeTabs } from '@/components/SwipeTabs'
import { haptic } from '@/lib/telegram'
import { scanReceipt } from '@/lib/ai'
import type { Category, TransactionType } from '@/types'

// Человекочитаемая дата: Сегодня · Вчера · 15 марта · 15 марта 2024
const formatDateLong = (d: Date): string => {
  const today = new Date()
  const sameYear = d.getFullYear() === today.getFullYear()
  const daysDiff = Math.floor((today.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
  if (daysDiff === 0) return 'Сегодня'
  if (daysDiff === 1) return 'Вчера'
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  const dd = d.getDate()
  const mm = MONTHS[d.getMonth()]
  return sameYear ? `${dd} ${mm}` : `${dd} ${mm} ${d.getFullYear()}`
}

// ISO-date для HTML input[type=date] — YYYY-MM-DD
const toInputDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Props {
  type: 'expense' | 'income'
  onClose: () => void
  onDone: () => void
  onAddCategory: (kind: 'expense' | 'income') => void
  onSwitchType?: (next: 'expense' | 'income' | 'transfer') => void
}

export const AddTransactionScreen: React.FC<Props> = ({ type, onClose, onDone, onAddCategory, onSwitchType }) => {
  const state = useStore()
  const { accounts, addTransaction } = state
  // v0.42: в расходах/доходах цели НЕ участвуют как счета — цели только в переводах
  const visibleAccounts = accounts.filter((a) => !a.archived && a.type !== 'goal')
  // Категории отсортированы по частоте использования (частые сверху).
  // useMemo чтобы пересчёт был только при изменении transactions/categories.
  const visibleCategories = useMemo(
    () => selectCategoriesByUsage(state, type),
    [state.transactions, state.categories, type]
  )

  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState<string>(visibleAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>(visibleCategories[0]?.id ?? '')
  const [comment, setComment] = useState('')
  const [txDate, setTxDate] = useState(new Date())
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Сканер чеков
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ merchant: string } | null>(null)

  const handleReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Сброс input чтобы можно было выбрать тот же файл снова
    if (fileInputRef.current) fileInputRef.current.value = ''

    haptic.light()
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const cats = visibleCategories.map((c) => ({ id: c.id, name: c.name }))
      const result = await scanReceipt(file, cats)

      // Заполняем форму
      setAmount(String(Math.round(result.amount)))
      if (result.categoryId) setCategoryId(result.categoryId)
      if (result.date) {
        const parsed = new Date(result.date)
        if (!isNaN(parsed.getTime())) setTxDate(parsed)
      }
      if (result.merchant) {
        setComment(result.merchant)
        setScanResult({ merchant: result.merchant })
      }

      haptic.success()
    } catch (err) {
      const msg = (err as Error).message
      setScanError(msg)
      haptic.error()
    } finally {
      setScanning(false)
    }
  }

  const account = visibleAccounts.find((a) => a.id === accountId)
  const amountNum = Number(amount)
  const canSave = amountNum > 0 && Boolean(accountId) && Boolean(categoryId)

  const save = () => {
    if (!canSave) return
    haptic.success()
    addTransaction({
      type: type as TransactionType,
      amount: amountNum,
      currency: account?.currency ?? 'RUB',
      accountId,
      categoryId,
      date: txDate.toISOString(),
      comment: comment.trim() || undefined,
    })
    onDone()
  }

  // Нет счетов — предлагаем создать
  if (visibleAccounts.length === 0) {
    return (
      <div className="flex flex-col h-full p-5">
        <div className="flex justify-between items-center mb-6">
          <BackButton onClick={onClose} />
          <div className="text-base font-medium">Новый {type === 'expense' ? 'расход' : 'доход'}</div>
          <div className="w-16" />
        </div>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-4xl mb-4">💳</div>
            <div className="text-sm text-text-secondary mb-4">
              Сначала добавь хотя бы один счёт
            </div>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-accent border-0 rounded-btn text-white text-sm font-medium cursor-pointer"
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Новый {type === 'expense' ? 'расход' : 'доход'}</div>
        {type === 'expense' ? (
          <button
            onClick={() => { haptic.light(); fileInputRef.current?.click() }}
            disabled={scanning}
            className="flex items-center gap-1 px-3 py-1.5 -mr-3 bg-bg-secondary border border-border rounded-btn text-accent text-sm cursor-pointer active:scale-95 transition-transform disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>{scanning ? '...' : 'Чек'}</span>
          </button>
        ) : (
          <div style={{ width: 72 }} />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReceiptPick}
          className="hidden"
        />
      </div>

      {/* v0.44: Скроллируемый средний блок — сумма/чипы/категории */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Индикатор сканирования / результата */}
        {(scanning || scanError || scanResult) && (
          <div className="px-5 pb-2">
            {scanning && (
              <div className="p-2.5 bg-accent/10 border border-accent/40 rounded-btn text-center">
                <div className="text-[11px] text-accent font-medium">🤖 ИИ читает чек...</div>
                <div className="text-[10px] text-text-muted mt-0.5">Обычно занимает 2-4 секунды</div>
              </div>
            )}
            {scanError && (
              <div className="p-2.5 bg-accent/10 border border-accent/50 rounded-btn">
                <div className="text-[11px] text-accent font-medium">⚠ Не получилось</div>
                <div className="text-[10px] text-text-secondary mt-0.5">{scanError}</div>
                <div className="text-[10px] text-text-faint mt-1">Заполни форму вручную или попробуй ещё раз</div>
              </div>
            )}
            {!scanning && !scanError && scanResult && (
              <div className="p-2.5 bg-success/10 border border-success/40 rounded-btn">
                <div className="text-[11px] text-success font-medium">✓ Распознано: {scanResult.merchant}</div>
                <div className="text-[10px] text-text-muted mt-0.5">Проверь данные и жми «Готово»</div>
              </div>
            )}
          </div>
        )}

      {/* v0.34: Сумма под макет — 52px, легкая */}
      <div className="px-5 pt-4 pb-3">
        <div style={{
          color: '#666', fontSize: 10, letterSpacing: '1.3px',
          fontWeight: 500, textTransform: 'uppercase', marginBottom: 4,
        }}>
          Сумма
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            color: type === 'expense' ? '#ff1744' : '#00c864',
            fontSize: 52, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1,
          }}>
            {type === 'expense' ? '−' : '+'}{amount}
          </span>
          <span style={{ color: '#666', fontSize: 22, fontWeight: 400 }}>
            {account?.currency === 'RUB' ? '₽' : account?.currency}
          </span>
        </div>
      </div>

      {/* v0.52: Счёт — dropdown одной строкой */}
      <div className="px-4 pb-2">
        <div style={{
          color: '#666', fontSize: 10, letterSpacing: '1.3px',
          fontWeight: 500, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4,
        }}>
          Счёт
        </div>
        {(() => {
          const a = account
          if (!a) return null
          const bank = a.type === 'card' ? bankById(a.bankId, state.settings.customBanks) : null
          const bankColor = bank?.color || (a.type === 'cash' ? '#2a2a2a' : '#1f1f1f')
          const isLight = ['#FFDD2D', '#FEE600', '#FFCC00'].includes(bankColor.toUpperCase())
          const textColor = isLight ? '#000' : '#fff'
          const letter = bank?.short || (a.type === 'cash' ? '₽' : (a.name.charAt(0) || '?').toUpperCase())
          return (
            <button
              onClick={() => { haptic.select(); setShowAccountPicker(true) }}
              className="w-full cursor-pointer flex items-center"
              style={{
                padding: '10px 13px',
                background: '#141414',
                border: '0.5px solid #222',
                borderRadius: 10,
                gap: 10,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 22, height: 22, background: bankColor,
                  borderRadius: 6, fontSize: 11, fontWeight: 800, color: textColor,
                }}
              >
                {letter}
              </div>
              <span style={{ flex: 1, textAlign: 'left', color: '#fff', fontSize: 13, fontWeight: 500 }}>
                {a.name}
              </span>
              <span style={{ color: '#666', fontSize: 12 }}>
                {Math.round(a.balance).toLocaleString('ru-RU')} {a.currency === 'RUB' ? '₽' : a.currency}
              </span>
              <span style={{ color: '#666', fontSize: 10, marginLeft: 4 }}>▾</span>
            </button>
          )
        })()}
      </div>

      {/* Категории */}
      <div className="px-5 pb-2">
        <div className="text-2xs text-text-muted uppercase tracking-wide mb-1.5">Категория</div>
        <div className="grid grid-cols-5 gap-1.5">
          {visibleCategories.slice(0, 9).map((c) => (
            <CategoryButton
              key={c.id}
              category={c}
              active={c.id === categoryId}
              onClick={() => { haptic.select(); setCategoryId(c.id) }}
            />
          ))}
          <button
            onClick={() => { haptic.select(); setShowCategoryPicker(true) }}
            className="aspect-square bg-bg-secondary border border-border rounded-btn flex flex-col items-center justify-center gap-0.5 text-accent cursor-pointer"
          >
            <span className="text-base font-light leading-none">⋯</span>
            <span className="text-[8px]">Ещё</span>
          </button>
        </div>
      </div>

      {/* Комментарий */}
      <div className="px-5 pb-2">
        <input
          type="text"
          placeholder="Комментарий (не обязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={140}
          className="w-full px-3.5 py-2.5 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
        />
      </div>

      {/* Дата */}
      <div className="px-5 pb-2">
        <button
          onClick={() => { haptic.select(); setShowDatePicker(true) }}
          className="w-full px-3.5 py-2.5 bg-bg-secondary border border-border rounded-btn flex items-center cursor-pointer relative"
        >
          <span className="absolute left-3.5">📅</span>
          <span className="text-sm flex-1 text-center">{formatDateLong(txDate)}</span>
          <span className="absolute right-3.5 text-text-muted text-xs">▾</span>
        </button>
      </div>
      </div>
      {/* конец скроллируемого блока */}

      {/* v0.44: Клавиатура — в потоке, не скроллится */}
      <div className="px-2.5 pt-2 pb-2 shrink-0">
        <NumPad value={amount} onChange={setAmount} />
      </div>

      {/* v0.44: CTA — в потоке с отступом от клавиатуры и низа */}
      <div
        className="px-3.5 shrink-0"
        style={{
          paddingTop: 4,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
        }}
      >
        <button
          onClick={save}
          disabled={!canSave}
          className="w-full py-4 rounded-btn text-base font-semibold cursor-pointer transition-all active:scale-[0.98] border-0"
          style={{
            background: canSave
              ? (type === 'income' ? '#00c864' : '#ff1744')
              : '#1f1f1f',
            color: canSave ? '#fff' : '#555',
            boxShadow: canSave
              ? `0 4px 16px ${type === 'income' ? 'rgba(0,200,100,0.45)' : 'rgba(255,23,68,0.45)'}`
              : 'none',
          }}
        >
          {canSave ? 'Подтвердить' : 'Введи сумму'}
        </button>
      </div>

      {/* Пикер счёта */}
      {showAccountPicker && (
        <div
          onClick={() => setShowAccountPicker(false)}
          className="fixed inset-0 bg-black/60 flex items-end z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up max-h-[70vh] overflow-y-auto"
          >
            <div className="text-sm font-medium mb-3">Выбрать счёт</div>
            {visibleAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  haptic.select()
                  setAccountId(a.id)
                  setShowAccountPicker(false)
                }}
                className={`w-full flex justify-between items-center py-3 px-3 rounded-btn cursor-pointer border-0 text-left mb-1 ${
                  a.id === accountId ? 'bg-accent/15 text-accent' : 'bg-transparent text-white'
                }`}
              >
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-text-muted">
                  {Math.round(a.balance).toLocaleString('ru-RU')} {a.currency === 'RUB' ? '₽' : a.currency}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Пикер категорий (все + создать новую) */}
      {showCategoryPicker && (
        <div
          onClick={() => setShowCategoryPicker(false)}
          className="fixed inset-0 bg-black/60 flex items-end z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up max-h-[75vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-medium">Все категории</div>
              <button
                onClick={() => {
                  haptic.light()
                  setShowCategoryPicker(false)
                  onAddCategory(type)
                }}
                className="text-xs text-accent bg-transparent border-0 cursor-pointer"
              >
                + Создать новую
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {visibleCategories.map((c) => (
                <CategoryButton
                  key={c.id}
                  category={c}
                  active={c.id === categoryId}
                  onClick={() => {
                    haptic.select()
                    setCategoryId(c.id)
                    setShowCategoryPicker(false)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Пикер даты */}
      {showDatePicker && (
        <div
          onClick={() => setShowDatePicker(false)}
          className="fixed inset-0 bg-black/60 flex items-end z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up"
          >
            <div className="text-sm font-medium mb-4">Дата операции</div>

            {/* Быстрые кнопки */}
            <div className="flex gap-2 mb-4">
              {[
                { label: 'Сегодня', days: 0 },
                { label: 'Вчера',   days: 1 },
                { label: '2 дня',   days: 2 },
                { label: 'Неделя',  days: 7 },
              ].map((q) => (
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

            {/* Нативный выбор — даёт календарь, можно уйти хоть в 2010 */}
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

  if (onSwitchType) {
    return (
      <SwipeTabs current={type} onSwitch={onSwitchType}>
        {content}
      </SwipeTabs>
    )
  }
  return content
}

const CategoryButton: React.FC<{
  category: Category
  active: boolean
  onClick: () => void
}> = ({ category, active, onClick }) => {
  const isIncome = category.type === 'income'

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-btn flex flex-col items-center justify-center gap-0.5 cursor-pointer border-0 px-0.5 transition-all"
      style={
        active
          ? {
              backgroundColor: isIncome
                ? 'rgba(var(--c-success), 0.08)'
                : 'rgba(var(--c-accent), 0.08)',
              border: `1.5px solid ${isIncome ? 'rgb(var(--c-success))' : 'rgb(var(--c-accent))'}`,
              boxShadow: isIncome
                ? '0 0 12px rgba(var(--c-success), 0.5), inset 0 0 8px rgba(var(--c-success), 0.15)'
                : '0 0 12px rgba(var(--c-accent), 0.5), inset 0 0 8px rgba(var(--c-accent), 0.15)',
            }
          : {
              backgroundColor: isIncome
                ? 'rgba(var(--c-success), 0.06)'
                : 'rgba(var(--c-accent), 0.06)',
            }
      }
    >
      <CategoryIcon iconId={category.icon} size="sm" variant="neutral" />
      <span
        className="text-[8px] font-medium truncate max-w-full leading-tight"
        style={
          active
            ? { color: isIncome ? 'rgb(var(--c-success))' : 'rgb(var(--c-accent))' }
            : undefined
        }
      >
        {category.name}
      </span>
    </button>
  )
}
