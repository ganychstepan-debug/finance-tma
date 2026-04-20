import { useState } from 'react'
import { useStore, selectTotalBalance, selectMonthIncome, selectMonthSpend, selectMonthTransactions } from '@/store'
import { HomeHeader } from '@/components/HomeHeader'
import { AccountCard } from '@/components/AccountCard'
import { TransactionRow } from '@/components/TransactionRow'
import { SwipeableRow } from '@/components/SwipeableRow'
import { formatMoneyShort, currencySign } from '@/lib/formatters'
import { iconById } from '@/lib/icons'
import { haptic } from '@/lib/telegram'

interface Props {
  onAddExpense: () => void
  onAddIncome: () => void
  onOpenAccounts: () => void
  onOpenTransactions: () => void
  onOpenAccountNew: () => void
  onOpenGoals: () => void
  onMenuOpen: () => void
  onOpenCurrency: () => void
  onEditTransaction: (id: string) => void
  onEditAccount: (id: string) => void
}

export const HomeScreen: React.FC<Props> = ({
  onAddExpense, onAddIncome, onOpenAccounts, onOpenTransactions, onOpenAccountNew,
  onOpenGoals, onMenuOpen, onOpenCurrency, onEditTransaction, onEditAccount,
}) => {
  const [month, setMonth] = useState(new Date())
  const state = useStore()

  // Если основная валюта не USD — разрешаем переключать отображение баланса между основной и USD
  const canToggleCurrency = state.settings.baseCurrency !== 'USD'
  const [showInUSD, setShowInUSD] = useState(false)
  const displayCurrency = showInUSD ? 'USD' : state.settings.baseCurrency

  const activeGoals = (state.goals ?? []).filter((g) => !g.archived)
  const getGoalProgress = (g: typeof activeGoals[0]): number => {
    if (g.linkedAccountId) {
      const acc = state.accounts.find((a) => a.id === g.linkedAccountId)
      return acc?.balance ?? 0
    }
    return g.manualProgress ?? 0
  }

  // Подсказка про свайп — показываем один раз при первой транзакции
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try {
      return !localStorage.getItem('hint_swipe_seen')
    } catch {
      return false
    }
  })
  const dismissHint = () => {
    try { localStorage.setItem('hint_swipe_seen', '1') } catch {}
    setShowSwipeHint(false)
  }

  const total = selectTotalBalance(state, displayCurrency)
  const monthIncome = selectMonthIncome(state, month.getFullYear(), month.getMonth())
  const monthSpend = selectMonthSpend(state, month.getFullYear(), month.getMonth())
  const monthDelta = monthIncome - monthSpend

  const visibleAccounts = state.accounts.filter((a) => !a.archived && a.type !== 'goal')
  // Последние 5 операций ЗА ВЫБРАННЫЙ МЕСЯЦ — от новых к старым по дате операции
  const recentTx = selectMonthTransactions(state, month.getFullYear(), month.getMonth())
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const totalStr = Math.round(total).toLocaleString('ru-RU')

  return (
    <div className="flex flex-col overflow-y-auto pb-4">
      <HomeHeader month={month} onMonthChange={setMonth} onMenuOpen={onMenuOpen} onOpenCurrency={onOpenCurrency} />

      <div className="px-5 py-5 text-center">
        <div className="text-2xs text-text-muted uppercase tracking-[1px] mb-1.5">
          Общий баланс
        </div>
        <div
          className="text-[48px] tracking-tight leading-none"
          style={{
            fontFamily: '"SF Pro Rounded", "SF Pro Display", -apple-system, system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: '-0.035em',
          }}
        >
          {canToggleCurrency ? (
            <button
              onClick={() => { haptic.select(); setShowInUSD((v) => !v) }}
              className="text-accent bg-transparent border-0 cursor-pointer p-0 m-0 align-baseline"
              style={{ fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit' }}
              aria-label="Переключить валюту отображения"
            >
              {currencySign(displayCurrency)}
            </button>
          ) : (
            <span className="text-accent">{currencySign(displayCurrency)}</span>
          )}{' '}
          {totalStr}
        </div>
        {monthDelta !== 0 && (
          <div
            className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-xl border ${
              monthDelta > 0
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-accent/10 border-accent/30 text-accent'
            }`}
            style={{ borderWidth: '0.5px' }}
          >
            <span className="text-xs">{monthDelta > 0 ? '▲' : '▼'}</span>
            <span className="text-xs">
              {monthDelta > 0 ? '+' : '−'}{formatMoneyShort(monthDelta)} ₽ за месяц
            </span>
          </div>
        )}
      </div>

      <div className="px-5 mb-3 flex justify-between items-baseline">
        <span className="text-sm font-medium">Счета</span>
        <button
          onClick={onOpenAccounts}
          className="text-xs text-accent bg-transparent border-0 cursor-pointer p-0"
        >
          Все →
        </button>
      </div>

      <div className="px-5 flex gap-2.5 scroll-x mb-5">
        {visibleAccounts.length === 0 ? (
          <button
            onClick={onOpenAccountNew}
            className="min-w-[150px] p-3.5 rounded-card bg-bg-secondary border border-dashed border-border text-text-muted text-sm cursor-pointer text-left"
          >
            <div className="text-accent text-2xl font-light mb-1">+</div>
            <div className="text-xs">Добавить счёт</div>
          </button>
        ) : (
          <>
            {visibleAccounts.map((a) => (
              <AccountCard key={a.id} account={a} onClick={() => onEditAccount(a.id)} />
            ))}
            <button
              onClick={onOpenAccountNew}
              className="min-w-[60px] rounded-card bg-bg-secondary border border-border text-accent text-2xl font-light cursor-pointer flex items-center justify-center"
            >
              +
            </button>
          </>
        )}
      </div>

      {/* Блок целей */}
      <div className="px-5 mb-3 flex justify-between items-baseline">
        <span className="text-sm font-medium">🎯 Цели накопления</span>
        {activeGoals.length > 0 && (
          <button
            onClick={onOpenGoals}
            className="text-xs text-accent bg-transparent border-0 cursor-pointer p-0"
          >
            Все →
          </button>
        )}
      </div>

      <div className="px-5 mb-5">
        {activeGoals.length === 0 ? (
          <button
            onClick={onOpenGoals}
            className="w-full py-4 rounded-card bg-bg-secondary border border-dashed border-border cursor-pointer flex items-center justify-center gap-2 text-text-muted"
          >
            <span className="text-accent text-lg leading-none">+</span>
            <span className="text-sm">Создать первую цель</span>
          </button>
        ) : (
          <div className="flex gap-2">
            {activeGoals.slice(0, 2).map((g) => {
              const progress = getGoalProgress(g)
              const pct = Math.min(100, Math.max(0, (progress / g.targetAmount) * 100))
              const deadlineStr = g.deadline
                ? `до ${new Date(g.deadline).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })}`
                : 'без срока'
              return (
                <button
                  key={g.id}
                  onClick={onOpenGoals}
                  className="flex-1 min-w-0 p-3 rounded-card bg-bg-secondary border border-border cursor-pointer text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-base leading-none">
                      {/\p{Extended_Pictographic}/u.test(g.icon) ? g.icon : (iconById(g.icon).emoji || '🎯')}
                    </span>
                    <span className="text-xs font-medium text-white truncate flex-1">{g.name}</span>
                  </div>
                  <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-text-muted truncate">
                      {formatMoneyShort(progress)} ₽
                    </span>
                    <span className="text-text-faint shrink-0 ml-1">{Math.round(pct)}% · {deadlineStr}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-5 mb-3 flex justify-between items-baseline">
        <span className="text-sm font-medium">
          {recentTx.length > 0 ? 'Последние за месяц' : 'В этом месяце'}
        </span>
        {recentTx.length > 0 && (
          <button
            onClick={onOpenTransactions}
            className="text-xs text-accent bg-transparent border-0 cursor-pointer p-0"
          >
            Все →
          </button>
        )}
      </div>

      <div className="px-5 pb-20">
        {recentTx.length === 0 ? (
          <div className="py-6 text-center text-text-muted text-xs">
            Нет операций в этом месяце.<br />
            Нажми на «+» чтобы добавить.
          </div>
        ) : (
          <>
            {showSwipeHint && (
              <div className="mb-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-btn flex items-center gap-2 animate-fade-in">
                <span className="text-base">👆</span>
                <span className="text-xs text-text-secondary flex-1">
                  Потяни операцию <span className="text-accent">влево</span>, чтобы удалить. Тап — редактировать.
                </span>
                <button
                  onClick={dismissHint}
                  className="text-text-muted text-sm bg-transparent border-0 cursor-pointer px-2 py-1"
                  aria-label="Закрыть подсказку"
                >
                  ✕
                </button>
              </div>
            )}
            {recentTx.map((tx, i) => (
              <SwipeableRow
                key={tx.id}
                onDelete={() => state.deleteTransaction(tx.id)}
              >
                <TransactionRow tx={tx} showDivider={i < recentTx.length - 1} onClick={() => onEditTransaction(tx.id)} />
              </SwipeableRow>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
