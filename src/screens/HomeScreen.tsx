import { useEffect, useState } from 'react'
import { useStore, selectTotalBalance, selectMonthIncome, selectMonthSpend } from '@/store'
import { HomeHeader } from '@/components/HomeHeader'
import { AccountCard } from '@/components/AccountCard'
import { TransactionRow } from '@/components/TransactionRow'
import { SwipeableRow } from '@/components/SwipeableRow'
import { formatMoneyShort, currencySign } from '@/lib/formatters'
import { iconById } from '@/lib/icons'
import { haptic } from '@/lib/telegram'
import { getRates, convert } from '@/lib/fx'

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

  // v0.66: курс подгружаем для эквивалента
  const [ratesLoaded, setRatesLoaded] = useState(false)
  useEffect(() => {
    getRates().then(() => setRatesLoaded(true)).catch(() => {})
  }, [])

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
  // v0.94: операции за 7 дней; если их <5, показываем 20 последних (после импорта старых)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekTx = state.transactions
    .filter((t) => new Date(t.date).getTime() >= weekAgo)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recentTx = weekTx.length >= 5
    ? weekTx
    : state.transactions
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20)

  const totalStr = Math.round(total).toLocaleString('ru-RU')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* v0.94: Верхний фиксированный блок — header, баланс, счета, цели */}
      <div className="flex-shrink-0">
        <HomeHeader month={month} onMonthChange={setMonth} onMenuOpen={onMenuOpen} onOpenCurrency={onOpenCurrency} />

      <div className="px-5 pt-3 pb-0" style={{ marginBottom: 10 }}>
        <div className="text-2xs text-text-muted" style={{ letterSpacing: '1.5px', fontWeight: 500 }}>
          ОБЩИЙ БАЛАНС{showInUSD ? ' · USD' : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
          {canToggleCurrency ? (
            <button
              onClick={() => { haptic.select(); setShowInUSD((v) => !v) }}
              className="bg-transparent border-0 cursor-pointer p-0 m-0"
              style={{ color: '#ff1744', fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}
              aria-label="Переключить валюту отображения"
            >
              {currencySign(displayCurrency)}
            </button>
          ) : (
            <span style={{ color: '#ff1744', fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {currencySign(displayCurrency)}
            </span>
          )}
          <span style={{
            color: '#fff', fontSize: 46, fontWeight: 700,
            letterSpacing: '-0.035em', lineHeight: 1,
            fontFamily: '"SF Pro Rounded", "SF Pro Display", -apple-system, system-ui, sans-serif',
          }}>
            {totalStr}
          </span>
        </div>

        {/* v0.66: Эквивалент в основной валюте через convert() */}
        {showInUSD && ratesLoaded && (() => {
          const baseCurrency = state.settings.baseCurrency
          const equiv = convert(total, 'USD', baseCurrency)
          // курс = сколько единиц base стоит 1 USD
          const rate = convert(1, 'USD', baseCurrency)
          const sign = currencySign(baseCurrency)
          return (
            <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>
              ≈ {Math.round(equiv).toLocaleString('ru-RU')} {sign} · 1 $ = {rate.toFixed(2)} {sign}
            </div>
          )
        })()}

        {monthDelta !== 0 && (
          <div
            className="inline-flex items-center"
            style={{
              gap: 5,
              padding: '4px 10px',
              background: monthDelta > 0 ? 'rgba(0,200,100,0.08)' : 'rgba(255,23,68,0.08)',
              border: `0.5px solid ${monthDelta > 0 ? 'rgba(0,200,100,0.2)' : 'rgba(255,23,68,0.2)'}`,
              borderRadius: 999,
              marginTop: 10,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill={monthDelta > 0 ? '#00c864' : '#ff1744'}>
              <path d={monthDelta > 0 ? 'M12 4L22 18H2z' : 'M12 20L2 6h20z'} />
            </svg>
            <span style={{
              color: monthDelta > 0 ? '#00c864' : '#ff1744',
              fontSize: 11, fontWeight: 600,
            }}>
              {monthDelta > 0 ? '+' : '−'}{formatMoneyShort(Math.abs(monthDelta))} ₽ за месяц
            </span>
          </div>
        )}
      </div>

      <div className="px-5 pt-3 mb-1.5">
        <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500 }}>
          СЧЕТА
        </div>
      </div>

      <div className="px-5 flex gap-2 scroll-x mb-3" style={{ paddingBottom: 4 }}>
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
      <div className="px-5 mb-1.5 flex justify-between items-baseline">
        <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500 }}>
          ЦЕЛИ
        </div>
        {activeGoals.length > 0 && (
          <button
            onClick={onOpenGoals}
            className="text-xs bg-transparent border-0 cursor-pointer p-0"
            style={{ color: '#ff1744', fontWeight: 500 }}
          >
            все ›
          </button>
        )}
      </div>

      <div className="px-5 mb-3">
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
      </div>
      {/* Конец фиксированного верхнего блока */}

      {/* v0.94: Скроллящаяся секция только для операций */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-4">

      <div className="px-5 mb-2 flex justify-between items-baseline">
        <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500 }}>
          {recentTx.length === 0 ? 'ПОСЛЕДНИЕ ОПЕРАЦИИ' : weekTx.length >= 5 ? 'ЗА НЕДЕЛЮ' : 'ПОСЛЕДНИЕ ОПЕРАЦИИ'}
        </div>
        {recentTx.length > 0 && (
          <button
            onClick={onOpenTransactions}
            className="text-xs bg-transparent border-0 cursor-pointer p-0"
            style={{ color: '#ff1744', fontWeight: 500 }}
          >
            все ›
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
            {/* v0.68: плашка в конце списка — переход ко всем операциям */}
            <button
              onClick={onOpenTransactions}
              className="w-full mt-3 py-3 cursor-pointer border-0 flex items-center justify-center"
              style={{
                background: 'rgba(255,23,68,0.08)',
                border: '0.5px solid rgba(255,23,68,0.2)',
                borderRadius: 12,
                color: '#ff1744',
                fontSize: 12,
                fontWeight: 500,
                gap: 6,
              }}
            >
              Все операции
              <span style={{ fontSize: 10 }}>›</span>
            </button>
          </>
        )}
      </div>
      </div>
      {/* конец скролл-контейнера операций */}
    </div>
  )
}
