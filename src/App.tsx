import { useState, useEffect } from 'react'
import { BottomNav, type Tab } from '@/components/BottomNav'
import { AddTypeSheet } from '@/components/AddTypeSheet'
import { MainMenuSheet } from '@/components/MainMenuSheet'
import { HomeScreen } from '@/screens/HomeScreen'
import { AccountsScreen } from '@/screens/AccountsScreen'
import { AccountEditScreen } from '@/screens/AccountEditScreen'
import { CategoriesScreen } from '@/screens/CategoriesScreen'
import { CategoryEditScreen } from '@/screens/CategoryEditScreen'
import { StatsScreen } from '@/screens/StatsScreen'
import { DebtsScreen } from '@/screens/DebtsScreen'
import { AddTransactionScreen } from '@/screens/AddTransactionScreen'
import { EditTransactionScreen } from '@/screens/EditTransactionScreen'
import { AllTransactionsScreen } from '@/screens/AllTransactionsScreen'
import { CurrencyScreen } from '@/screens/CurrencyScreen'
import { WipeScreen } from '@/screens/WipeScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { TransferScreen } from '@/screens/TransferScreen'
import { GoalsScreen } from '@/screens/GoalsScreen'
import { ChangelogScreen } from '@/screens/ChangelogScreen'
import { ChannelPromptScreen } from '@/screens/ChannelPromptScreen'
import { ReferralScreen } from '@/screens/ReferralScreen'
import { WeeklySummarySheet, shouldShowWeeklySummary, markWeeklySummaryShown } from '@/components/WeeklySummarySheet'
import { GoalAchievedSheet, getAchievedShown, markAchievedShown } from '@/components/GoalAchievedSheet'
import { BotPendingSheet } from '@/components/BotPendingSheet'
import { fetchPendingTxs } from '@/lib/botPending'
import { useStore } from '@/store'
import { APP_VERSION, ONBOARDING_VERSION } from '@/lib/version'
import { completeReferralOnServer } from '@/lib/referral'

type Modal =
  | { kind: 'none' }
  | { kind: 'accounts' }
  | { kind: 'account-edit'; id?: string; from?: 'home' | 'accounts' }
  | { kind: 'category-edit'; id?: string; categoryType?: 'expense' | 'income' }
  | { kind: 'add-tx'; txType: 'expense' | 'income' }
  | { kind: 'transfer' }
  | { kind: 'edit-tx'; txId: string }
  | { kind: 'all-tx' }
  | { kind: 'currency' }
  | { kind: 'wipe' }
  | { kind: 'goals' }
  | { kind: 'referral' }

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [modal, setModal] = useState<Modal>({ kind: 'none' })
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(false)
  const [achievedGoalId, setAchievedGoalId] = useState<string | null>(null)
  const [botPendingOpen, setBotPendingOpen] = useState(false)
  const { goals, accounts } = useStore()

  // Онбординг: показываем один раз при первом запуске
  // или при смене версии (когда добавили новые важные слайды)
  const [onboarding, setOnboarding] = useState<boolean>(() => {
    try {
      const seen = localStorage.getItem('onboarding_version')
      return seen !== String(ONBOARDING_VERSION)
    } catch {
      return false
    }
  })

  // Changelog: показываем только если версия приложения обновилась
  const [changelog, setChangelog] = useState<boolean>(() => {
    try {
      const seen = localStorage.getItem('changelog_version')
      // Если юзер впервые — не показываем changelog (онбординг достаточно)
      if (!seen) return false
      return seen !== String(APP_VERSION)
    } catch {
      return false
    }
  })

  // Триггеры локальных уведомлений — проверяем когда нет модалок и онбординга
  useEffect(() => {
    // Недельная сводка — в понедельник утром или воскресенье вечером
    if (onboarding || changelog || modal.kind !== 'none' || weeklySummary || achievedGoalId) return
    if (shouldShowWeeklySummary()) {
      setWeeklySummary(true)
    }
  }, [onboarding, changelog, modal.kind, weeklySummary, achievedGoalId])

  // Pending транзакции из бота — проверяем при старте
  useEffect(() => {
    if (onboarding || changelog) return
    let cancelled = false
    fetchPendingTxs().then((items) => {
      if (cancelled) return
      if (items.length > 0) setBotPendingOpen(true)
    })
    return () => { cancelled = true }
  }, [onboarding, changelog])

  // Достижение цели — ищем цель которая достигла 100% и ещё не была показана
  useEffect(() => {
    if (onboarding || changelog || modal.kind !== 'none' || weeklySummary || achievedGoalId) return
    const shown = getAchievedShown()
    for (const goal of goals) {
      if (shown.includes(goal.id)) continue
      // Вычисляем прогресс цели
      let progress = 0
      if (goal.linkedAccountId) {
        const acc = accounts.find((a) => a.id === goal.linkedAccountId)
        progress = acc?.balance ?? 0
      } else {
        progress = goal.manualProgress ?? 0
      }
      if (progress >= goal.targetAmount) {
        setAchievedGoalId(goal.id)
        break  // показываем по одной за раз
      }
    }
  }, [goals, accounts, onboarding, changelog, modal.kind, weeklySummary, achievedGoalId])

  // Попап канала: показываем один раз после онбординга
  const [channelPrompt, setChannelPrompt] = useState<boolean>(false)

  if (onboarding) {
    return (
      <div className="h-screen flex flex-col">
        <OnboardingScreen onDone={() => {
          try {
            localStorage.setItem('onboarding_version', String(ONBOARDING_VERSION))
            localStorage.setItem('changelog_version', String(APP_VERSION))
          } catch {}
          // Всегда пытаемся подтвердить реферал — сервер сам разберётся,
          // есть pending или нет. Идемпотентно.
          completeReferralOnServer().catch(() => {})
          setOnboarding(false)
          // После онбординга — предложить канал, если ещё не предлагали
          try {
            if (!localStorage.getItem('channel_prompt_seen')) {
              setChannelPrompt(true)
            }
          } catch {}
        }} />
      </div>
    )
  }

  if (channelPrompt) {
    return (
      <div className="h-screen flex flex-col">
        <ChannelPromptScreen onDone={() => {
          try { localStorage.setItem('channel_prompt_seen', '1') } catch {}
          setChannelPrompt(false)
        }} />
      </div>
    )
  }

  if (changelog) {
    return (
      <div className="h-screen flex flex-col">
        <ChangelogScreen onDone={() => {
          try { localStorage.setItem('changelog_version', String(APP_VERSION)) } catch {}
          setChangelog(false)
        }} />
      </div>
    )
  }

  const close = () => setModal({ kind: 'none' })

  // ============================================================================
  // Полноэкранные модалки (поверх табов)
  // ============================================================================

  if (modal.kind === 'accounts') {
    return (
      <div className="h-screen flex flex-col">
        <AccountsScreen
          onClose={close}
          onAddNew={() => setModal({ kind: 'account-edit' })}
          onEdit={(id) => setModal({ kind: 'account-edit', id })}
        />
      </div>
    )
  }

  if (modal.kind === 'account-edit') {
    const returnTo = modal.from === 'home' ? { kind: 'none' as const } : { kind: 'accounts' as const }
    return (
      <div className="h-screen flex flex-col">
        <AccountEditScreen
          editId={modal.id}
          onClose={() => setModal(returnTo)}
          onDone={() => setModal(returnTo)}
        />
      </div>
    )
  }

  if (modal.kind === 'category-edit') {
    return (
      <div className="h-screen flex flex-col">
        <CategoryEditScreen
          editId={modal.id}
          defaultType={modal.categoryType}
          onClose={close}
          onDone={close}
        />
      </div>
    )
  }

  if (modal.kind === 'add-tx') {
    return (
      <div className="h-screen flex flex-col">
        <AddTransactionScreen
          type={modal.txType}
          onClose={close}
          onDone={close}
          onAddCategory={(kind) => setModal({ kind: 'category-edit', categoryType: kind })}
          onSwitchType={(next) => {
            if (next === 'transfer') setModal({ kind: 'transfer' })
            else setModal({ kind: 'add-tx', txType: next })
          }}
        />
      </div>
    )
  }

  if (modal.kind === 'edit-tx') {
    return (
      <div className="h-screen flex flex-col">
        <EditTransactionScreen
          txId={modal.txId}
          onClose={close}
          onDone={close}
        />
      </div>
    )
  }

  if (modal.kind === 'all-tx') {
    return (
      <div className="h-screen flex flex-col">
        <AllTransactionsScreen
          onClose={close}
          onEditTransaction={(id) => setModal({ kind: 'edit-tx', txId: id })}
        />
      </div>
    )
  }

  if (modal.kind === 'currency') {
    return (
      <div className="h-screen flex flex-col">
        <CurrencyScreen onClose={close} />
      </div>
    )
  }

  if (modal.kind === 'wipe') {
    return (
      <div className="h-screen flex flex-col">
        <WipeScreen onClose={close} />
      </div>
    )
  }

  if (modal.kind === 'transfer') {
    return (
      <div className="h-screen flex flex-col">
        <TransferScreen
          onClose={close}
          onDone={close}
          onSwitchType={(next) => {
            if (next === 'transfer') return
            setModal({ kind: 'add-tx', txType: next })
          }}
        />
      </div>
    )
  }

  if (modal.kind === 'goals') {
    return (
      <div className="h-screen flex flex-col">
        <GoalsScreen onClose={close} />
      </div>
    )
  }

  if (modal.kind === 'referral') {
    return (
      <div className="h-screen flex flex-col">
        <ReferralScreen onClose={close} />
      </div>
    )
  }

  // ============================================================================
  // Основное приложение с табами
  // ============================================================================

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'home' && (
          <HomeScreen
            onAddExpense={() => setModal({ kind: 'add-tx', txType: 'expense' })}
            onAddIncome={() => setModal({ kind: 'add-tx', txType: 'income' })}
            onOpenAccounts={() => setModal({ kind: 'accounts' })}
            onOpenTransactions={() => setModal({ kind: 'all-tx' })}
            onOpenAccountNew={() => setModal({ kind: 'account-edit' })}
            onOpenGoals={() => setModal({ kind: 'goals' })}
            onMenuOpen={() => setMenuOpen(true)}
            onOpenCurrency={() => setModal({ kind: 'currency' })}
            onEditTransaction={(id) => setModal({ kind: 'edit-tx', txId: id })}
            onEditAccount={(id) => setModal({ kind: 'account-edit', id, from: 'home' })}
          />
        )}
        {tab === 'categories' && (
          <CategoriesScreen
            onAddNew={(txType) => setModal({ kind: 'category-edit', categoryType: txType })}
            onEdit={(id) => setModal({ kind: 'category-edit', id })}
          />
        )}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'debts' && <DebtsScreen />}
      </div>

      <BottomNav active={tab} onChange={setTab} onAddTap={() => setAddSheetOpen(true)} />

      {/* Шит выбора Расход/Доход (центральная кнопка +) */}
      {addSheetOpen && (
        <AddTypeSheet
          onChoose={(type) => {
            setAddSheetOpen(false)
            if (type === 'transfer') {
              setModal({ kind: 'transfer' })
            } else {
              setModal({ kind: 'add-tx', txType: type })
            }
          }}
          onClose={() => setAddSheetOpen(false)}
        />
      )}

      {/* Главное меню (тап на аватар) */}
      {menuOpen && (
        <MainMenuSheet
          onClose={() => setMenuOpen(false)}
          onOpenWipe={() => { setMenuOpen(false); setModal({ kind: 'wipe' }) }}
          onOpenGoals={() => { setMenuOpen(false); setModal({ kind: 'goals' }) }}
          onOpenReferral={() => { setMenuOpen(false); setModal({ kind: 'referral' }) }}
          onShowChangelog={() => {
            setMenuOpen(false)
            // Сбрасываем метку, чтобы при следующем открытии она снова появилась.
            // А здесь — сразу включаем экран через React state.
            try { localStorage.removeItem('changelog_version') } catch {}
            setChangelog(true)
          }}
          onShowOnboarding={() => {
            setMenuOpen(false)
            try { localStorage.removeItem('onboarding_version') } catch {}
            setOnboarding(true)
          }}
        />
      )}

      {/* Локальная недельная сводка */}
      {weeklySummary && (
        <WeeklySummarySheet
          onClose={() => {
            markWeeklySummaryShown()
            setWeeklySummary(false)
          }}
        />
      )}

      {/* Локальное уведомление — достижение цели */}
      {achievedGoalId && (() => {
        const goal = goals.find((g) => g.id === achievedGoalId)
        if (!goal) return null
        return (
          <GoalAchievedSheet
            goal={goal}
            onClose={() => {
              markAchievedShown(achievedGoalId)
              setAchievedGoalId(null)
            }}
          />
        )
      })()}

      {/* Pending из бота — текст/голос превращённые в карточку */}
      {botPendingOpen && (
        <BotPendingSheet onClose={() => setBotPendingOpen(false)} />
      )}
    </div>
  )
}
