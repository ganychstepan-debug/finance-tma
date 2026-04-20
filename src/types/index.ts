// ============================================================================
// Общие типы
// ============================================================================

export type UUID = string
export type ISODate = string // ISO 8601

// Встроенные валюты + любой пользовательский код (3-4 буквы: AED, CHF и т.д.)
export type Currency = string

export const BUILTIN_CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'BYN', 'UAH'] as const
export type BuiltinCurrency = typeof BUILTIN_CURRENCIES[number]

// ============================================================================
// Счета
// ============================================================================

export type AccountType = 'card' | 'cash' | 'deposit' | 'wallet' | 'goal'

export interface Account {
  id: UUID
  name: string
  type: AccountType
  bankId?: string        // ссылка на справочник банков (для card)
  balance: number
  currency: Currency
  icon: string           // id иконки
  color?: string         // акцентный цвет
  includeInTotal: boolean
  archived: boolean
  createdAt: ISODate
}

// ============================================================================
// Категории
// ============================================================================

export type CategoryType = 'expense' | 'income'

export interface Category {
  id: UUID
  name: string
  type: CategoryType
  icon: string
  color?: string
  budgetMonthly: number | null  // null = без бюджета, работает только для expense
  isCustom: boolean
  archived: boolean
  sortOrder: number
}

// ============================================================================
// Транзакции
// ============================================================================

export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Transaction {
  id: UUID
  type: TransactionType
  amount: number          // всегда положительное. Для transfer — сумма списания
  currency: Currency      // для transfer — валюта списания (валюта accountId)
  accountId: UUID         // откуда
  categoryId?: UUID       // null для transfer
  toAccountId?: UUID      // только для transfer
  amountTo?: number       // только для transfer в разных валютах: сумма зачисления
  toCurrency?: Currency   // только для transfer в разных валютах: валюта зачисления
  date: ISODate
  comment?: string
  createdAt: ISODate
}

// ============================================================================
// Долги
// ============================================================================

export type DebtDirection = 'owe' | 'owed'   // я должен / мне должны

export interface Debt {
  id: UUID
  direction: DebtDirection
  counterparty: string
  amount: number
  currency: Currency
  linkedAccountId?: UUID
  startDate: ISODate
  dueDate?: ISODate
  comment?: string
  status: 'active' | 'paid'
  createdAt: ISODate
}

// ============================================================================
// Цели накопления
// ============================================================================

export interface Goal {
  id: UUID
  name: string
  icon: string                  // id иконки категории (из CATEGORY_ICONS) или эмодзи
  targetAmount: number
  currency: Currency
  deadline?: ISODate            // опциональный дедлайн
  linkedAccountId?: UUID        // если привязана к счёту, прогресс = баланс счёта
  manualProgress?: number       // если не привязана к счёту, юзер сам вносит прогресс
  color?: string
  archived: boolean
  createdAt: ISODate
}

// ============================================================================
// Настройки
// ============================================================================

export interface Settings {
  baseCurrency: Currency
  notificationsEnabled: boolean
  writeAccessGranted: boolean
  writeAccessRequestedAt?: ISODate
  reminderTime?: string
  budgetAlertEnabled: boolean
  weeklyDigestEnabled: boolean
  onboardingCompleted: boolean
  customCurrencies: string[]
  customBanks?: CustomBank[]        // до 5 пользовательских банков
  referredBy?: number               // ID пригласившего юзера (из ?startapp=ref_XXX)
  referredAt?: ISODate              // когда было зафиксировано приглашение
}

export interface CustomBank {
  id: string        // 'custom_<timestamp>'
  name: string
  short: string     // 1-2 буквы
  color: string     // hex фон
}

// ============================================================================
// Метаданные
// ============================================================================

export interface Meta {
  schemaVersion: number
  lastSyncAt?: ISODate
  userId?: number               // Telegram user id
}

// ============================================================================
// Состояние приложения (для Zustand)
// ============================================================================

export interface AppState {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  debts: Debt[]
  goals: Goal[]
  settings: Settings
  meta: Meta
}
