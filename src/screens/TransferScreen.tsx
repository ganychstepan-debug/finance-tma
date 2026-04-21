import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { NumPad } from '@/components/NumPad'
import { haptic } from '@/lib/telegram'
import { currencySign } from '@/lib/formatters'
import { bankById, iconById } from '@/lib/icons'
import { BankIcon } from '@/components/BankIcons'
import { BackButton } from '@/components/BackButton'
import { SwipeTabs } from '@/components/SwipeTabs'
import { convert, getRates } from '@/lib/fx'
import type { Account } from '@/types'

interface Props {
  onClose: () => void
  onDone: () => void
  onSwitchType?: (next: 'expense' | 'income' | 'transfer') => void
}

const toInputDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const MONTHS_LONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const formatDateLong = (d: Date): string => {
  const today = new Date()
  const daysDiff = Math.floor((today.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
  if (daysDiff === 0) return 'Сегодня'
  if (daysDiff === 1) return 'Вчера'
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : ''}`
}

const roundMoney = (n: number): number => Math.round(n * 100) / 100

export const TransferScreen: React.FC<Props> = ({ onClose, onDone, onSwitchType }) => {
  const { accounts, goals, addTransaction, addAccount, updateGoal } = useStore()
  // Счета для выбора как источник — все видимые, включая цели
  // (разрешаем переводить и С цели на цель или обратно)
  const visibleAccounts = accounts.filter((a) => !a.archived && a.type !== 'goal')
  // Активные цели (для режима «На цель»)
  const activeGoals = (goals ?? []).filter((g) => !g.archived)

  // Режим перевода: на другой счёт или на цель
  const [mode, setMode] = useState<'account' | 'goal'>('account')
  const [selectedGoalId, setSelectedGoalId] = useState<string>(activeGoals[0]?.id ?? '')

  const [amountFrom, setAmountFrom] = useState('0')
  const [amountTo, setAmountTo]     = useState('0')
  const [fromId, setFromId]         = useState<string>(visibleAccounts[0]?.id ?? '')
  const [toId, setToId]             = useState<string>(visibleAccounts[1]?.id ?? visibleAccounts[0]?.id ?? '')
  const [comment, setComment]       = useState('')
  const [txDate, setTxDate]         = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerFor, setPickerFor]   = useState<'from' | 'to' | null>(null)
  const [editingTo, setEditingTo]   = useState(false)
  const [userEditedTo, setUserEditedTo] = useState(false)
  const [showComment, setShowComment] = useState(false)

  const fromAcc = visibleAccounts.find((a) => a.id === fromId)
  const toAcc   = visibleAccounts.find((a) => a.id === toId)
  const selectedGoal = activeGoals.find((g) => g.id === selectedGoalId)

  const differentCurrencies = Boolean(fromAcc && toAcc && fromAcc.currency !== toAcc.currency)

  useEffect(() => { getRates().catch(() => {}) }, [])

  useEffect(() => {
    if (!fromAcc || !toAcc) return
    if (!differentCurrencies) {
      setAmountTo(amountFrom)
      return
    }
    if (userEditedTo) return
    const num = Number(amountFrom)
    if (isNaN(num) || num <= 0) {
      setAmountTo('0')
      return
    }
    const converted = convert(num, fromAcc.currency, toAcc.currency)
    setAmountTo(String(roundMoney(converted)))
  }, [amountFrom, fromAcc?.currency, toAcc?.currency, differentCurrencies, userEditedTo])

  const amountFromNum = Number(amountFrom)
  const amountToNum   = Number(amountTo)

  const canSave = mode === 'account'
    ? (
        amountFromNum > 0 &&
        (!differentCurrencies || amountToNum > 0) &&
        Boolean(fromId) &&
        Boolean(toId) &&
        fromId !== toId
      )
    : (
        amountFromNum > 0 &&
        Boolean(fromId) &&
        Boolean(selectedGoalId)
      )

  const swap = () => {
    haptic.select()
    const fromIdOld = fromId
    setFromId(toId)
    setToId(fromIdOld)
    setUserEditedTo(false)
    setEditingTo(false)
  }

  const save = () => {
    if (!canSave || !fromAcc) return

    // Первый перевод на цель — показать предупреждение о списании со счёта
    if (mode === 'goal') {
      try {
        const seenWarning = localStorage.getItem('goal_transfer_warning_seen')
        if (!seenWarning) {
          const ok = window.confirm(
            'Перевод на цель уменьшит баланс счёта, с которого переводишь.\n\n' +
            'Деньги останутся в общем балансе — просто теперь они «припаркованы» в копилке цели.\n\n' +
            'Продолжить?'
          )
          if (!ok) return
          localStorage.setItem('goal_transfer_warning_seen', '1')
        }
      } catch {}
    }

    // В режиме goal — резолвим или создаём целевой счёт
    let finalToId = toId
    let finalToAcc = toAcc

    if (mode === 'goal') {
      const goal = activeGoals.find((g) => g.id === selectedGoalId)
      if (!goal) return

      if (goal.linkedAccountId) {
        // У цели уже есть привязанный счёт — используем его
        const linkedAcc = accounts.find((a) => a.id === goal.linkedAccountId && !a.archived)
        if (linkedAcc) {
          finalToId = linkedAcc.id
          finalToAcc = linkedAcc
        } else {
          // Привязанный счёт удалён — создаём новый
          const newAcc = addAccount({
            name: goal.name,
            type: 'goal',
            balance: goal.manualProgress ?? 0,
            currency: goal.currency,
            icon: goal.icon || 'piggy',
            includeInTotal: false,
            archived: false,
          })
          updateGoal(goal.id, { linkedAccountId: newAcc.id })
          finalToId = newAcc.id
          finalToAcc = newAcc
        }
      } else {
        // Создаём скрытый целевой счёт и привязываем цель к нему
        const newAcc = addAccount({
          name: goal.name,
          type: 'goal',
          balance: goal.manualProgress ?? 0,
          currency: goal.currency,
          icon: goal.icon || 'piggy',
          includeInTotal: false,
          archived: false,
        })
        updateGoal(goal.id, { linkedAccountId: newAcc.id })
        finalToId = newAcc.id
        finalToAcc = newAcc
      }
    }

    if (!finalToAcc) return
    const finalDifferentCurrencies = fromAcc.currency !== finalToAcc.currency

    haptic.success()
    addTransaction({
      type: 'transfer',
      amount: amountFromNum,
      currency: fromAcc.currency,
      accountId: fromId,
      toAccountId: finalToId,
      amountTo: finalDifferentCurrencies ? amountToNum : undefined,
      toCurrency: finalDifferentCurrencies ? finalToAcc.currency : undefined,
      date: txDate.toISOString(),
      comment: comment.trim() || undefined,
    })
    onDone()
  }

  const effectiveRate = differentCurrencies && amountFromNum > 0 && amountToNum > 0
    ? roundMoney(amountFromNum / amountToNum)
    : null

  // Для перевода между счетами нужно минимум 2 счёта,
  // для перевода на цель — минимум 1 счёт и 1 цель.
  const notEnoughAccounts = mode === 'account'
    ? visibleAccounts.length < 2
    : visibleAccounts.length < 1 || activeGoals.length < 1

  if (notEnoughAccounts) {
    const message = mode === 'account'
      ? <>Для перевода нужно минимум два счёта.<br />Создай ещё один.</>
      : visibleAccounts.length < 1
        ? <>Создай хотя бы один счёт,<br />чтобы пополнять цели.</>
        : <>Сначала создай цель —<br />тогда сможешь на неё переводить.</>

    return (
      <div className="flex flex-col h-full p-5">
        <div className="flex justify-between items-center mb-6">
          <BackButton onClick={onClose} />
          <div className="text-base font-medium">Перевод</div>
          <div className="w-16" />
        </div>

        {/* Переключатель режимов остаётся доступным */}
        {visibleAccounts.length >= 1 && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { haptic.select(); setMode('account') }}
              className={`flex-1 py-2.5 rounded-btn text-sm border-0 cursor-pointer ${mode === 'account' ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'}`}
            >Между счетами</button>
            <button
              onClick={() => { haptic.select(); setMode('goal') }}
              className={`flex-1 py-2.5 rounded-btn text-sm border-0 cursor-pointer ${mode === 'goal' ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'}`}
            >На цель</button>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div>
            <div className="text-4xl mb-4">{mode === 'account' ? '💳' : '🎯'}</div>
            <div className="text-sm text-text-secondary mb-4">{message}</div>
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

  const activeAmount = editingTo ? amountTo : amountFrom
  const setActiveAmount = (v: string) => {
    if (editingTo) {
      setAmountTo(v)
      setUserEditedTo(true)
    } else {
      setAmountFrom(v)
    }
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Перевод</div>
        <div className="w-16" />
      </div>

      {/* Таб-переключатель: счёт или цель */}
      {activeGoals.length > 0 && (
        <div className="px-5 pb-2 flex gap-1.5 shrink-0">
          <button
            onClick={() => { haptic.select(); setMode('account') }}
            className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
              mode === 'account' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
            }`}
          >
            Между счетами
          </button>
          <button
            onClick={() => { haptic.select(); setMode('goal') }}
            className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
              mode === 'goal' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
            }`}
          >
            🎯 На цель
          </button>
        </div>
      )}

      {/* Компактная зона: счета + суммы */}
      <div className="px-5 shrink-0">
        {/* Счёт ИЗ */}
        <button
          onClick={() => { haptic.select(); setEditingTo(false); setPickerFor(null) }}
          className={`w-full px-3 py-2.5 rounded-btn text-left border transition-colors cursor-pointer flex items-center gap-2.5 ${
            !editingTo ? 'bg-bg-secondary border-accent' : 'bg-bg-secondary border-border'
          }`}
        >
          <AccountMini account={fromAcc} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-text-muted uppercase tracking-wide">Со счёта</div>
            <div className="text-xs font-medium truncate">{fromAcc?.name}</div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-light leading-none ${amountFromNum === 0 ? 'text-text-muted' : 'text-accent'}`}>
              −{amountFrom}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">{currencySign(fromAcc?.currency ?? 'RUB')}</div>
          </div>
        </button>

        {/* Ряд: свап + changers */}
        <div className="flex items-center gap-1.5 my-1.5">
          <button
            onClick={() => { haptic.select(); setPickerFor('from') }}
            className="flex-1 py-1 bg-transparent border-0 text-[10px] text-text-muted cursor-pointer"
          >
            ↑ изменить
          </button>
          {mode === 'account' ? (
            <button
              onClick={swap}
              className="w-7 h-7 rounded-full bg-bg-tertiary border border-border flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Поменять местами"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3v14M3 13l4 4 4-4M17 21V7M13 11l4-4 4 4" />
              </svg>
            </button>
          ) : (
            <div className="w-7 h-7 rounded-full bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
              <span className="text-[11px] text-accent">↓</span>
            </div>
          )}
          <button
            onClick={() => { haptic.select(); setPickerFor('to') }}
            className="flex-1 py-1 bg-transparent border-0 text-[10px] text-text-muted cursor-pointer"
          >
            ↓ {mode === 'goal' ? 'выбрать цель' : 'изменить'}
          </button>
        </div>

        {/* Счёт НА / Цель */}
        {mode === 'account' ? (
          <button
            onClick={() => { haptic.select(); setEditingTo(true); setPickerFor(null) }}
            className={`w-full px-3 py-2.5 rounded-btn text-left border transition-colors cursor-pointer flex items-center gap-2.5 ${
              editingTo ? 'bg-bg-secondary border-accent' : 'bg-bg-secondary border-border'
            }`}
          >
            <AccountMini account={toAcc} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-text-muted uppercase tracking-wide">На счёт</div>
              <div className="text-xs font-medium truncate">{toAcc?.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg font-light leading-none ${amountToNum === 0 ? 'text-text-muted' : 'text-success'}`}>
                +{amountTo}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">{currencySign(toAcc?.currency ?? 'RUB')}</div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => { haptic.select(); setPickerFor('to') }}
            className="w-full px-3 py-2.5 rounded-btn text-left border bg-bg-secondary border-border cursor-pointer flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-[10px] bg-accent/15 flex items-center justify-center shrink-0">
              <span className="text-base">
                {selectedGoal
                  ? (/\p{Extended_Pictographic}/u.test(selectedGoal.icon)
                      ? selectedGoal.icon
                      : (iconById(selectedGoal.icon).emoji || '🎯'))
                  : '🎯'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-text-muted uppercase tracking-wide">На цель</div>
              <div className="text-xs font-medium truncate">
                {selectedGoal?.name || 'Выбери цель'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg font-light leading-none ${amountFromNum === 0 ? 'text-text-muted' : 'text-success'}`}>
                +{amountFrom}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {currencySign(selectedGoal?.currency ?? fromAcc?.currency ?? 'RUB')}
              </div>
            </div>
          </button>
        )}

        {/* Курс (компактно) */}
        {differentCurrencies && (
          <div className="mt-2 px-3 py-1.5 bg-bg-tertiary rounded flex items-center justify-between text-[10px]">
            <span className="text-text-muted">
              Курс: {effectiveRate ? `1 ${toAcc?.currency} = ${effectiveRate} ${fromAcc?.currency}` : '—'}
            </span>
            {userEditedTo && (
              <button
                onClick={() => { haptic.select(); setUserEditedTo(false) }}
                className="text-accent bg-transparent border-0 cursor-pointer"
              >
                По ЦБ РФ
              </button>
            )}
          </div>
        )}

        {/* Доп.опции: дата + комментарий */}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => { haptic.select(); setShowDatePicker(true) }}
            className="flex-1 py-1.5 bg-transparent border border-border rounded text-[11px] text-text-secondary cursor-pointer truncate"
          >
            📅 {formatDateLong(txDate)}
          </button>
          <button
            onClick={() => { haptic.select(); setShowComment(!showComment) }}
            className={`flex-1 py-1.5 bg-transparent border rounded text-[11px] cursor-pointer truncate ${
              comment ? 'border-accent text-accent' : 'border-border text-text-secondary'
            }`}
          >
            💬 {comment ? 'Комментарий ✓' : 'Комментарий'}
          </button>
        </div>

        {/* Комментарий раскрывается по нажатию */}
        {showComment && (
          <input
            type="text"
            placeholder="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={140}
            autoFocus
            className="w-full mt-2 px-3 py-2 bg-bg-secondary border border-border rounded-btn text-white text-xs box-border"
          />
        )}
      </div>

      {/* Клавиатура — с запасом снизу до кнопки */}
      <div className="flex-1 flex flex-col justify-end px-5 pb-6 pt-2 min-h-0">
        <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5 text-center shrink-0">
          {editingTo
            ? `Сумма зачисления (${toAcc?.currency})`
            : `Сумма списания (${fromAcc?.currency})`}
        </div>
        <NumPad value={activeAmount} onChange={setActiveAmount} />
      </div>

      {/* Закреплённая снизу кнопка Готово — с отступами по бокам */}
      <div
        className="shrink-0"
        style={{
          paddingTop: 4,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
      >
        <button
          onClick={save}
          disabled={!canSave}
          className={`w-full py-4 rounded-btn text-base font-medium cursor-pointer transition-all active:scale-[0.98] ${
            canSave
              ? 'bg-accent text-white border-0 shadow-[0_4px_20px_rgba(var(--c-accent-glow-strong),0.4)]'
              : 'bg-bg-tertiary text-text-faint border-0'
          }`}
        >
          {canSave ? 'Подтвердить' : 'Заполни сумму'}
        </button>
      </div>

      {/* Пикер счёта / цели */}
      {pickerFor && (
        <div onClick={() => setPickerFor(null)} className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up max-h-[70vh] overflow-y-auto">
            <div className="text-sm font-medium mb-3">
              {mode === 'goal' && pickerFor === 'to'
                ? 'Выбери цель'
                : pickerFor === 'from' ? 'Откуда переводим' : 'Куда переводим'}
            </div>

            {/* Список целей если режим goal и пикер "to" */}
            {mode === 'goal' && pickerFor === 'to' ? (
              activeGoals.map((g) => {
                const isSelected = g.id === selectedGoalId
                const progress = g.linkedAccountId
                  ? accounts.find((a) => a.id === g.linkedAccountId)?.balance ?? 0
                  : g.manualProgress ?? 0
                const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100))
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      haptic.select()
                      setSelectedGoalId(g.id)
                      setPickerFor(null)
                    }}
                    className={`w-full flex items-center gap-3 py-3 px-3 rounded-btn cursor-pointer border-0 text-left mb-1 ${
                      isSelected ? 'bg-accent/15 text-accent' : 'bg-transparent text-white'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-accent/15 flex items-center justify-center shrink-0">
                      <span className="text-lg">
                        {/\p{Extended_Pictographic}/u.test(g.icon)
                          ? g.icon
                          : (iconById(g.icon).emoji || '🎯')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{g.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {Math.round(progress).toLocaleString('ru-RU')} / {Math.round(g.targetAmount).toLocaleString('ru-RU')} {currencySign(g.currency)} · {pct}%
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              // Список счетов — фильтруем цели из источника
              visibleAccounts
                .filter((a) => mode === 'goal' && pickerFor === 'from' ? a.type !== 'goal' : true)
                .map((a) => {
                  const isOther = pickerFor === 'from' ? a.id === toId : a.id === fromId
                  const isSelected = pickerFor === 'from' ? a.id === fromId : a.id === toId
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        if (isOther) return
                        haptic.select()
                        if (pickerFor === 'from') {
                          setFromId(a.id)
                        } else {
                          setToId(a.id)
                        }
                        setUserEditedTo(false)
                        setPickerFor(null)
                      }}
                      disabled={isOther}
                      className={`w-full flex justify-between items-center py-3 px-3 rounded-btn cursor-pointer border-0 text-left mb-1 ${
                        isSelected ? 'bg-accent/15 text-accent' : isOther ? 'bg-transparent text-text-faint opacity-40' : 'bg-transparent text-white'
                      }`}
                    >
                      <span className="text-sm">
                        {a.type === 'goal' ? '🎯 ' : ''}{a.name}{isOther && ' (уже выбран)'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {Math.round(a.balance).toLocaleString('ru-RU')} {currencySign(a.currency)}
                      </span>
                    </button>
                  )
                })
            )}
          </div>
        </div>
      )}

      {/* Пикер даты */}
      {showDatePicker && (
        <div onClick={() => setShowDatePicker(false)} className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-bg-secondary rounded-t-3xl p-5 pb-6 animate-slide-up">
            <div className="text-sm font-medium mb-4">Дата операции</div>
            <div className="flex gap-2 mb-4">
              {[{ label: 'Сегодня', days: 0 }, { label: 'Вчера', days: 1 }, { label: '2 дня', days: 2 }, { label: 'Неделя', days: 7 }].map((q) => (
                <button
                  key={q.days}
                  onClick={() => { haptic.select(); const d = new Date(); d.setDate(d.getDate() - q.days); setTxDate(d) }}
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

  if (onSwitchType) {
    return (
      <SwipeTabs current="transfer" onSwitch={onSwitchType}>
        {content}
      </SwipeTabs>
    )
  }
  return content
}

const AccountMini: React.FC<{ account?: Account }> = ({ account }) => {
  if (!account) return null
  const bank = account.type === 'card' ? bankById(account.bankId) : null
  const emoji = account.type === 'cash' ? '💵' : account.type === 'deposit' ? '🏦' : '👛'
  if (bank) return <BankIcon bankId={bank.id} size={28} className="shrink-0" />
  return (
    <div className="w-7 h-7 rounded-md bg-bg-tertiary flex items-center justify-center text-sm shrink-0">
      {emoji}
    </div>
  )
}
