import type { AppState } from '@/types'
import { cloud } from './telegram'

const LS_KEY = 'finance_app_state'
const SCHEMA_VERSION = 1

// ============================================================================
// LocalStorage — L1 кэш
// ============================================================================

export const loadLocal = (): AppState | null => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    if (parsed.meta?.schemaVersion !== SCHEMA_VERSION) {
      console.warn('Schema version mismatch, resetting')
      return null
    }
    // Мягкие миграции для новых полей без полного сброса
    if (!Array.isArray((parsed as any).goals)) {
      (parsed as any).goals = []
    }
    if (!Array.isArray((parsed.settings as any).customCurrencies)) {
      (parsed.settings as any).customCurrencies = []
    }
    if (typeof (parsed.settings as any).writeAccessGranted !== 'boolean') {
      (parsed.settings as any).writeAccessGranted = false
    }
    return parsed
  } catch (e) {
    console.error('loadLocal failed', e)
    return null
  }
}

export const saveLocal = (state: AppState): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('saveLocal failed', e)
  }
}

// ============================================================================
// CloudStorage — L2 синхронизация
// ============================================================================

// Шардинг: транзакции по месяцам (tx_YYYY_MM)
// Остальное — одним ключом (размер мал)

const monthKey = (date: string): string => {
  const d = new Date(date)
  return `tx_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const syncToCloud = async (state: AppState): Promise<void> => {
  try {
    // Группируем транзакции по месяцам
    const txByMonth: Record<string, typeof state.transactions> = {}
    for (const tx of state.transactions) {
      const key = monthKey(tx.date)
      if (!txByMonth[key]) txByMonth[key] = []
      txByMonth[key].push(tx)
    }

    await Promise.all([
      cloud.set('accounts', JSON.stringify(state.accounts)),
      cloud.set('categories', JSON.stringify(state.categories)),
      cloud.set('debts', JSON.stringify(state.debts)),
      cloud.set('goals', JSON.stringify(state.goals ?? [])),
      cloud.set('settings', JSON.stringify(state.settings)),
      cloud.set('meta', JSON.stringify({ ...state.meta, lastSyncAt: new Date().toISOString() })),
      ...Object.entries(txByMonth).map(([k, v]) => cloud.set(k, JSON.stringify(v))),
    ])
  } catch (e) {
    console.error('syncToCloud failed', e)
  }
}

export const loadFromCloud = async (): Promise<Partial<AppState> | null> => {
  try {
    const keys = await cloud.keys()
    if (keys.length === 0) return null

    const staticKeys = ['accounts', 'categories', 'debts', 'goals', 'settings', 'meta']
    const txKeys = keys.filter((k) => k.startsWith('tx_'))
    const data = await cloud.getMany([...staticKeys, ...txKeys])

    const parse = <T,>(raw: string | undefined, fallback: T): T => {
      if (!raw) return fallback
      try {
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    }

    const transactions = txKeys.flatMap((k) => parse(data[k], []))

    return {
      accounts: parse(data.accounts, []),
      categories: parse(data.categories, []),
      transactions,
      debts: parse(data.debts, []),
      goals: parse(data.goals, []),
      settings: parse(data.settings, undefined as any),
      meta: parse(data.meta, undefined as any),
    }
  } catch (e) {
    console.error('loadFromCloud failed', e)
    return null
  }
}
