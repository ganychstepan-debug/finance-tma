import { create } from 'zustand'
import type {
  Account, Category, Transaction, Debt, Goal, Settings, Meta, AppState,
  UUID, Currency, ISODate,
} from '@/types'
import { loadLocal, saveLocal, syncToCloud, loadFromCloud } from '@/lib/storage'
import { convert } from '@/lib/fx'

// ============================================================================
// Дефолтные данные — создаются при первом запуске
// ============================================================================

let __uidCounter = 0
const uid = (): UUID =>
  `${Date.now().toString(36)}-${(__uidCounter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const now = (): string => new Date().toISOString()

const defaultCategories: Omit<Category, 'id'>[] = [
  // Расходы
  { name: 'Еда',           type: 'expense', icon: 'food',         budgetMonthly: null, isCustom: false, archived: false, sortOrder: 1 },
  { name: 'Транспорт',     type: 'expense', icon: 'transport',    budgetMonthly: null, isCustom: false, archived: false, sortOrder: 2 },
  { name: 'Дом',           type: 'expense', icon: 'home',         budgetMonthly: null, isCustom: false, archived: false, sortOrder: 3 },
  { name: 'Развлечения',   type: 'expense', icon: 'fun',          budgetMonthly: null, isCustom: false, archived: false, sortOrder: 4 },
  { name: 'Одежда',        type: 'expense', icon: 'clothes',      budgetMonthly: null, isCustom: false, archived: false, sortOrder: 5 },
  { name: 'Здоровье',      type: 'expense', icon: 'health',       budgetMonthly: null, isCustom: false, archived: false, sortOrder: 6 },
  { name: 'Поездки',       type: 'expense', icon: 'travel',       budgetMonthly: null, isCustom: false, archived: false, sortOrder: 7 },
  { name: 'Связь',         type: 'expense', icon: 'phone',        budgetMonthly: null, isCustom: false, archived: false, sortOrder: 8 },
  { name: 'Подарки',       type: 'expense', icon: 'gift',         budgetMonthly: null, isCustom: false, archived: false, sortOrder: 9 },
  { name: 'Образование',   type: 'expense', icon: 'book',         budgetMonthly: null, isCustom: false, archived: false, sortOrder: 10 },
  { name: 'Спорт',         type: 'expense', icon: 'sport',        budgetMonthly: null, isCustom: false, archived: false, sortOrder: 11 },
  { name: 'Подписки',      type: 'expense', icon: 'subscription', budgetMonthly: null, isCustom: false, archived: false, sortOrder: 12 },
  // Доходы
  { name: 'Зарплата',      type: 'income',  icon: 'salary',       budgetMonthly: null, isCustom: false, archived: false, sortOrder: 1 },
  { name: 'Фриланс',       type: 'income',  icon: 'freelance',    budgetMonthly: null, isCustom: false, archived: false, sortOrder: 2 },
  { name: 'Инвестиции',    type: 'income',  icon: 'invest',       budgetMonthly: null, isCustom: false, archived: false, sortOrder: 3 },
  { name: 'Кэшбэк',        type: 'income',  icon: 'cashback',     budgetMonthly: null, isCustom: false, archived: false, sortOrder: 4 },
  { name: 'Подарок',       type: 'income',  icon: 'gift',         budgetMonthly: null, isCustom: false, archived: false, sortOrder: 5 },
  { name: 'Прочее',        type: 'income',  icon: 'other',        budgetMonthly: null, isCustom: false, archived: false, sortOrder: 6 },
]

const createInitialState = (): AppState => ({
  accounts: [],
  categories: defaultCategories.map((c) => ({ ...c, id: uid() })),
  transactions: [],
  debts: [],
  goals: [],
  settings: {
    baseCurrency: 'RUB',
    notificationsEnabled: false,
    writeAccessGranted: false,
    budgetAlertEnabled: true,
    weeklyDigestEnabled: true,
    onboardingCompleted: false,
    customCurrencies: [],
    customBanks: [],
  },
  meta: {
    schemaVersion: 1,
  },
})

// ============================================================================
// Store interface
// ============================================================================

interface Store extends AppState {
  // Счета
  addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => Account
  updateAccount: (id: UUID, patch: Partial<Account>) => void
  deleteAccount: (id: UUID) => void
  toggleInTotal: (id: UUID) => void

  // Категории
  addCategory: (c: Omit<Category, 'id'>) => Category
  updateCategory: (id: UUID, patch: Partial<Category>) => void
  deleteCategory: (id: UUID) => void

  // Транзакции
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Transaction
  updateTransaction: (id: UUID, patch: Partial<Transaction>) => void
  deleteTransaction: (id: UUID) => void

  // Долги
  addDebt: (d: Omit<Debt, 'id' | 'createdAt'>) => Debt
  updateDebt: (id: UUID, patch: Partial<Debt>) => void
  deleteDebt: (id: UUID) => void

  // Цели
  addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => Goal
  updateGoal: (id: UUID, patch: Partial<Goal>) => void
  deleteGoal: (id: UUID) => void

  // Настройки
  updateSettings: (patch: Partial<Settings>) => void
  addCustomCurrency: (code: string) => void
  removeCustomCurrency: (code: string) => void
  addCustomBank: (name: string, short: string, color: string) => string | null
  removeCustomBank: (id: string) => void

  // Утилита для сброса
  reset: () => void
  wipeTransactions: (from?: ISODate, to?: ISODate) => number
  wipeAll: () => void

  // Восстановление из Telegram CloudStorage
  restoreFromCloud: () => Promise<{ restored: boolean; transactions: number }>
}

// ============================================================================
// Store implementation
// ============================================================================

const initialState = loadLocal() ?? createInitialState()

// Debounced синхронизация с Telegram CloudStorage
// Накапливаем изменения и шлём одним пакетом через 2 секунды после последней правки.
let syncTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 2000

const scheduleCloudSync = (state: AppState) => {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncToCloud(state).then(() => {
      // v0.78: обновляем lastSyncAt в state чтобы экран 5.15 показывал актуальное время
      const now = new Date().toISOString()
      useStore.setState((s) => ({
        ...s,
        meta: { ...s.meta, lastSyncAt: now },
      }))
    }).catch((e) => console.warn('cloud sync failed', e))
  }, SYNC_DEBOUNCE_MS)
}

const persist = (state: AppState) => {
  saveLocal(state)
  scheduleCloudSync(state)
}

export const useStore = create<Store>((set, get) => ({
  ...initialState,

  // --- Счета ---
  addAccount: (a) => {
    const account: Account = { ...a, id: uid(), createdAt: now() }
    set((s) => {
      const next = { ...s, accounts: [...s.accounts, account] }
      persist(next)
      return next
    })
    return account
  },

  updateAccount: (id, patch) => {
    set((s) => {
      const next = {
        ...s,
        accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }
      persist(next)
      return next
    })
  },

  deleteAccount: (id) => {
    set((s) => {
      const next = {
        ...s,
        accounts: s.accounts.filter((a) => a.id !== id),
        transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
      }
      persist(next)
      return next
    })
  },

  toggleInTotal: (id) => {
    const a = get().accounts.find((x) => x.id === id)
    if (!a) return
    get().updateAccount(id, { includeInTotal: !a.includeInTotal })
  },

  // --- Категории ---
  addCategory: (c) => {
    const cat: Category = { ...c, id: uid() }
    set((s) => {
      const next = { ...s, categories: [...s.categories, cat] }
      persist(next)
      return next
    })
    return cat
  },

  updateCategory: (id, patch) => {
    set((s) => {
      const next = {
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }
      persist(next)
      return next
    })
  },

  deleteCategory: (id) => {
    set((s) => {
      const next = {
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        // Транзакции с этой категорией сохраняются, но категория становится «(удалена)»
        transactions: s.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: undefined } : t
        ),
      }
      persist(next)
      return next
    })
  },

  // --- Транзакции ---
  addTransaction: (t) => {
    const tx: Transaction = { ...t, id: uid(), createdAt: now() }

    set((s) => {
      // Пересчитываем баланс счёта(ов)
      const accounts = s.accounts.map((a) => {
        if (tx.type === 'expense' && a.id === tx.accountId) {
          return { ...a, balance: a.balance - tx.amount }
        }
        if (tx.type === 'income' && a.id === tx.accountId) {
          return { ...a, balance: a.balance + tx.amount }
        }
        if (tx.type === 'transfer') {
          if (a.id === tx.accountId) return { ...a, balance: a.balance - tx.amount }
          if (a.id === tx.toAccountId) {
            // Если перевод в другой валюте и задана amountTo — зачисляем её, иначе amount
            const credit = tx.amountTo ?? tx.amount
            return { ...a, balance: a.balance + credit }
          }
        }
        return a
      })

      const next = { ...s, transactions: [tx, ...s.transactions], accounts }
      persist(next)
      return next
    })

    return tx
  },

  updateTransaction: (id, patch) => {
    set((s) => {
      const oldTx = s.transactions.find((t) => t.id === id)
      if (!oldTx) return s

      const newTx: Transaction = { ...oldTx, ...patch }

      // Пересчёт баланса: 1) откатить старую, 2) применить новую.
      // Используем дельту на каждый счёт.
      const delta: Record<string, number> = {}
      const apply = (accId: string, sign: 1 | -1, amount: number) => {
        delta[accId] = (delta[accId] ?? 0) + sign * amount
      }

      // Откат старой операции (инверсия)
      if (oldTx.type === 'expense') apply(oldTx.accountId, +1, oldTx.amount)
      else if (oldTx.type === 'income') apply(oldTx.accountId, -1, oldTx.amount)
      else if (oldTx.type === 'transfer') {
        apply(oldTx.accountId, +1, oldTx.amount)
        if (oldTx.toAccountId) apply(oldTx.toAccountId, -1, oldTx.amountTo ?? oldTx.amount)
      }

      // Применение новой
      if (newTx.type === 'expense') apply(newTx.accountId, -1, newTx.amount)
      else if (newTx.type === 'income') apply(newTx.accountId, +1, newTx.amount)
      else if (newTx.type === 'transfer') {
        apply(newTx.accountId, -1, newTx.amount)
        if (newTx.toAccountId) apply(newTx.toAccountId, +1, newTx.amountTo ?? newTx.amount)
      }

      const accounts = s.accounts.map((a) =>
        delta[a.id] != null ? { ...a, balance: a.balance + delta[a.id] } : a
      )

      const next = {
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? newTx : t)),
        accounts,
      }
      persist(next)
      return next
    })
  },

  deleteTransaction: (id) => {
    set((s) => {
      const tx = s.transactions.find((t) => t.id === id)
      if (!tx) return s

      // Откатываем баланс
      const accounts = s.accounts.map((a) => {
        if (tx.type === 'expense' && a.id === tx.accountId) {
          return { ...a, balance: a.balance + tx.amount }
        }
        if (tx.type === 'income' && a.id === tx.accountId) {
          return { ...a, balance: a.balance - tx.amount }
        }
        if (tx.type === 'transfer') {
          if (a.id === tx.accountId) return { ...a, balance: a.balance + tx.amount }
          if (a.id === tx.toAccountId) {
            const credit = tx.amountTo ?? tx.amount
            return { ...a, balance: a.balance - credit }
          }
        }
        return a
      })

      const next = {
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
        accounts,
      }
      persist(next)
      return next
    })
  },

  // --- Долги ---
  addDebt: (d) => {
    const debt: Debt = { ...d, id: uid(), createdAt: now() }
    set((s) => {
      const next = { ...s, debts: [debt, ...s.debts] }
      persist(next)
      return next
    })
    return debt
  },

  updateDebt: (id, patch) => {
    set((s) => {
      const next = {
        ...s,
        debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }
      persist(next)
      return next
    })
  },

  deleteDebt: (id) => {
    set((s) => {
      const next = { ...s, debts: s.debts.filter((d) => d.id !== id) }
      persist(next)
      return next
    })
  },

  // --- Цели ---
  addGoal: (g) => {
    const goal: Goal = { ...g, id: uid(), createdAt: now() }
    set((s) => {
      const next = { ...s, goals: [goal, ...s.goals] }
      persist(next)
      return next
    })
    return goal
  },

  updateGoal: (id, patch) => {
    set((s) => {
      const next = {
        ...s,
        goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }
      persist(next)
      return next
    })
  },

  deleteGoal: (id) => {
    set((s) => {
      const next = { ...s, goals: s.goals.filter((g) => g.id !== id) }
      persist(next)
      return next
    })
  },

  // --- Настройки ---
  updateSettings: (patch) => {
    set((s) => {
      const next = { ...s, settings: { ...s.settings, ...patch } }
      persist(next)
      return next
    })
  },

  addCustomCurrency: (code) => {
    const normalized = code.trim().toUpperCase().slice(0, 4)
    if (!normalized || !/^[A-Z]{2,4}$/.test(normalized)) return
    set((s) => {
      if (s.settings.customCurrencies.includes(normalized)) return s
      const next = {
        ...s,
        settings: {
          ...s.settings,
          customCurrencies: [...s.settings.customCurrencies, normalized],
        },
      }
      persist(next)
      return next
    })
  },

  removeCustomCurrency: (code) => {
    set((s) => {
      const next = {
        ...s,
        settings: {
          ...s.settings,
          customCurrencies: s.settings.customCurrencies.filter((c) => c !== code),
        },
      }
      persist(next)
      return next
    })
  },

  addCustomBank: (name, short, color) => {
    const trimmed = name.trim().slice(0, 30)
    const shortTrimmed = short.trim().slice(0, 2).toUpperCase() || '?'
    if (!trimmed) return null
    let createdId: string | null = null
    set((s) => {
      const existing = s.settings.customBanks ?? []
      if (existing.length >= 5) return s
      const id = `custom_${Date.now()}`
      createdId = id
      const next = {
        ...s,
        settings: {
          ...s.settings,
          customBanks: [...existing, { id, name: trimmed, short: shortTrimmed, color }],
        },
      }
      persist(next)
      return next
    })
    return createdId
  },

  removeCustomBank: (id) => {
    set((s) => {
      const existing = s.settings.customBanks ?? []
      const next = {
        ...s,
        settings: {
          ...s.settings,
          customBanks: existing.filter((b) => b.id !== id),
        },
      }
      persist(next)
      return next
    })
  },

  reset: () => {
    const fresh = createInitialState()
    persist(fresh)
    set(fresh)
  },

  // Удаление транзакций за период. Балансы счетов пересчитываются (откат).
  wipeTransactions: (from, to) => {
    let removed = 0
    set((s) => {
      const fromT = from ? new Date(from).getTime() : -Infinity
      const toT   = to   ? new Date(to).getTime()   : +Infinity

      const toRemove = s.transactions.filter((t) => {
        const d = new Date(t.date).getTime()
        return d >= fromT && d <= toT
      })
      removed = toRemove.length
      if (removed === 0) return s

      // Собираем дельту откатов по каждому счёту
      const delta: Record<string, number> = {}
      for (const tx of toRemove) {
        if (tx.type === 'expense') {
          delta[tx.accountId] = (delta[tx.accountId] ?? 0) + tx.amount
        } else if (tx.type === 'income') {
          delta[tx.accountId] = (delta[tx.accountId] ?? 0) - tx.amount
        } else if (tx.type === 'transfer') {
          delta[tx.accountId] = (delta[tx.accountId] ?? 0) + tx.amount
          if (tx.toAccountId) delta[tx.toAccountId] = (delta[tx.toAccountId] ?? 0) - (tx.amountTo ?? tx.amount)
        }
      }

      const accounts = s.accounts.map((a) =>
        delta[a.id] != null ? { ...a, balance: a.balance + delta[a.id] } : a
      )

      const keep = new Set(s.transactions.filter((t) => !toRemove.includes(t)).map((t) => t.id))
      const next = {
        ...s,
        accounts,
        transactions: s.transactions.filter((t) => keep.has(t.id)),
      }
      persist(next)
      return next
    })
    return removed
  },

  wipeAll: () => {
    const fresh = createInitialState()
    persist(fresh)
    set(fresh)
  },

  restoreFromCloud: async () => {
    try {
      const cloudData = await loadFromCloud()
      if (!cloudData) return { restored: false, transactions: 0 }
      if (!cloudData.accounts || cloudData.accounts.length === 0) {
        // Нет данных в облаке — считаем что восстанавливать нечего
        return { restored: false, transactions: 0 }
      }

      const current = get()
      const merged: AppState = {
        accounts: cloudData.accounts ?? current.accounts,
        categories: cloudData.categories && cloudData.categories.length > 0
          ? cloudData.categories
          : current.categories,
        transactions: cloudData.transactions ?? [],
        debts: cloudData.debts ?? [],
        goals: cloudData.goals ?? [],
        settings: cloudData.settings
          ? { ...current.settings, ...cloudData.settings }
          : current.settings,
        meta: cloudData.meta ?? current.meta,
      }

      saveLocal(merged)
      set(merged)

      return { restored: true, transactions: merged.transactions.length }
    } catch (e) {
      console.error('restoreFromCloud failed', e)
      return { restored: false, transactions: 0 }
    }
  },
}))

// ============================================================================
// Селекторы (для удобства — чистые функции, не hooks)
// ============================================================================

export const selectTotalBalance = (state: AppState, base: Currency = 'RUB'): number => {
  // Суммируем ВСЕ активные счета, конвертируя в базовую валюту через курсы ЦБ РФ.
  // Целевые счета (type === 'goal') — тоже входят, т.к. деньги физически принадлежат пользователю.
  return state.accounts
    .filter((a) => !a.archived && (a.includeInTotal || a.type === 'goal'))
    .reduce((sum, a) => sum + convert(a.balance, a.currency, base), 0)
}

export const selectMonthTransactions = (
  state: AppState,
  year: number,
  month: number // 0-indexed
): Transaction[] => {
  return state.transactions.filter((t) => {
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
}

export const selectMonthSpend = (state: AppState, year: number, month: number): number => {
  const base = state.settings.baseCurrency
  return selectMonthTransactions(state, year, month)
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + convert(t.amount, t.currency, base), 0)
}

export const selectMonthIncome = (state: AppState, year: number, month: number): number => {
  const base = state.settings.baseCurrency
  return selectMonthTransactions(state, year, month)
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + convert(t.amount, t.currency, base), 0)
}

export const selectCategorySpend = (
  state: AppState,
  categoryId: UUID,
  year: number,
  month: number
): number => {
  const base = state.settings.baseCurrency
  return selectMonthTransactions(state, year, month)
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + convert(t.amount, t.currency, base), 0)
}

/**
 * Возвращает категории отсортированные по частоте использования.
 *
 * Логика взвешивания:
 * — Учитываем только последние 90 дней (свежее поведение важнее старого)
 * — Категории без единой транзакции идут в конец в своём исходном порядке
 * — При равной частоте — сортируем по дате последнего использования
 *
 * @param txType — 'expense' или 'income'. Фильтруем и категории, и транзакции.
 */
export const selectCategoriesByUsage = (
  state: AppState,
  txType: 'expense' | 'income'
): Category[] => {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000

  // Считаем частоту и последнюю дату использования для каждой категории
  const stats = new Map<string, { count: number; lastUsed: number }>()

  for (const tx of state.transactions) {
    if (tx.type !== txType) continue
    if (!tx.categoryId) continue
    const txTime = new Date(tx.date).getTime()
    if (txTime < ninetyDaysAgo) continue

    const existing = stats.get(tx.categoryId) ?? { count: 0, lastUsed: 0 }
    existing.count += 1
    if (txTime > existing.lastUsed) existing.lastUsed = txTime
    stats.set(tx.categoryId, existing)
  }

  // Сохраняем исходный индекс для стабильной сортировки
  const categoriesWithIndex = state.categories
    .filter((c) => c.type === txType && !c.archived)
    .map((c, originalIdx) => ({
      category: c,
      stat: stats.get(c.id),
      originalIdx,
    }))

  categoriesWithIndex.sort((a, b) => {
    const aCount = a.stat?.count ?? 0
    const bCount = b.stat?.count ?? 0
    // 1. По убыванию частоты
    if (aCount !== bCount) return bCount - aCount
    // 2. При равной частоте — по свежести использования
    const aLast = a.stat?.lastUsed ?? 0
    const bLast = b.stat?.lastUsed ?? 0
    if (aLast !== bLast) return bLast - aLast
    // 3. При равных всех — по исходному порядку
    return a.originalIdx - b.originalIdx
  })

  return categoriesWithIndex.map((c) => c.category)
}
