/**
 * Обёртка над Upstash KV (Redis) для хранения данных юзеров.
 *
 * Структура ключей:
 *   user:{telegram_id} → UserRecord (JSON)
 *   users:active       → Set<telegram_id> — для cron рассылок
 *
 * Почему через REST API а не через `@upstash/redis` клиент:
 * - На Vercel Edge runtime работают оба варианта, REST проще дебажить
 * - Меньше зависимостей → меньше риск несовместимости
 */

const KV_URL = (globalThis as any).process?.env?.KV_REST_API_URL
  ?? (typeof process !== 'undefined' ? process.env?.KV_REST_API_URL : undefined)

const KV_TOKEN = (globalThis as any).process?.env?.KV_REST_API_TOKEN
  ?? (typeof process !== 'undefined' ? process.env?.KV_REST_API_TOKEN : undefined)

export interface UserRecord {
  telegramId: string
  firstName?: string
  username?: string
  createdAt: string         // ISO дата первого ping'а
  lastActivityAt: string    // ISO дата последнего ping'а
  notifications: {
    enabled: boolean
    dropIn: boolean         // напоминания если 3+ дня не заходил
    daily: boolean          // ежедневные в заданное время
    dailyTime: string       // "21:00"
  }
  lastDropInAt?: string     // ISO дата последнего drop-in уведомления — чтобы не спамить
  lastDailyAt?: string      // последнее ежедневное — чтобы не слать дважды в день
}

const DEFAULT_NOTIFICATIONS: UserRecord['notifications'] = {
  enabled: false,
  dropIn: true,
  daily: false,
  dailyTime: '21:00',
}

// ============================================================================
// Низкоуровневый REST доступ
// ============================================================================

const kvRequest = async (path: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> => {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV не настроен (KV_REST_API_URL / KV_REST_API_TOKEN)')
  }
  const res = await fetch(`${KV_URL}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`KV ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.result
}

// ============================================================================
// Юзеры
// ============================================================================

export const getUser = async (telegramId: string): Promise<UserRecord | null> => {
  const raw = await kvRequest(`get/user:${telegramId}`)
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

export const setUser = async (user: UserRecord): Promise<void> => {
  await kvRequest(`set/user:${user.telegramId}`, 'POST', JSON.stringify(user))
  // Добавляем в Set активных юзеров
  await kvRequest(`sadd/users:active/${user.telegramId}`, 'POST')
}

export const listActiveUserIds = async (): Promise<string[]> => {
  const result = await kvRequest('smembers/users:active')
  return Array.isArray(result) ? result.map(String) : []
}

// ============================================================================
// Высокоуровневые операции
// ============================================================================

/**
 * Ping: юзер зашёл в приложение.
 * Создаёт запись если её не было, обновляет lastActivityAt.
 */
export const pingUser = async (
  telegramId: string,
  firstName?: string,
  username?: string,
): Promise<UserRecord> => {
  const now = new Date().toISOString()
  const existing = await getUser(telegramId)

  const user: UserRecord = existing
    ? { ...existing, lastActivityAt: now, firstName, username }
    : {
        telegramId,
        firstName,
        username,
        createdAt: now,
        lastActivityAt: now,
        notifications: DEFAULT_NOTIFICATIONS,
      }

  await setUser(user)
  return user
}

export const updateNotifications = async (
  telegramId: string,
  patch: Partial<UserRecord['notifications']>,
): Promise<UserRecord | null> => {
  const user = await getUser(telegramId)
  if (!user) return null
  user.notifications = { ...user.notifications, ...patch }
  await setUser(user)
  return user
}

export const markDropInSent = async (telegramId: string): Promise<void> => {
  const user = await getUser(telegramId)
  if (!user) return
  user.lastDropInAt = new Date().toISOString()
  await setUser(user)
}

export const markDailySent = async (telegramId: string): Promise<void> => {
  const user = await getUser(telegramId)
  if (!user) return
  user.lastDailyAt = new Date().toISOString()
  await setUser(user)
}

// ============================================================================
// Реферальная программа
// ============================================================================
//
// Структура ключей:
//   ref:by:{newUserId}       → {inviterId} — кто пригласил этого юзера
//   ref:count:{inviterId}    → число подтверждённых приглашений
//   ref:list:{inviterId}     → Set<newUserId> — защита от двойного зачёта
//   ref:pending:{newUserId}  → {inviterId} — реф-код получен ботом, ждёт подтверждения из Mini App

/**
 * Бот получил /start ref_<inviterId> — фиксируем pending.
 * Подтверждение произойдёт когда Mini App вызовет completeReferral.
 */
export const setPendingReferral = async (
  newUserId: string,
  inviterId: string,
): Promise<void> => {
  if (newUserId === inviterId) return
  // Уже есть зафиксированная рефералка — не перезаписываем
  const existing = await kvRequest(`get/ref:by:${newUserId}`)
  if (existing) return
  // Передаём значение через path, чтобы Upstash не оборачивал в кавычки
  await kvRequest(`set/ref:pending:${newUserId}/${encodeURIComponent(inviterId)}`, 'POST')
}

/**
 * Mini App подтверждает что юзер прошёл онбординг.
 * Переводит pending в подтверждённое приглашение, инкрементит счётчик пригласителя.
 * Возвращает inviterId если новое приглашение было засчитано, иначе null.
 */
export const completeReferral = async (newUserId: string): Promise<string | null> => {
  // Уже подтверждено раньше — идемпотентность
  const already = await kvRequest(`get/ref:by:${newUserId}`)
  if (already) return null

  const pending = await kvRequest(`get/ref:pending:${newUserId}`)
  if (!pending) return null
  // На случай старых записей с кавычками — чистим
  const raw = typeof pending === 'string' ? pending : String(pending)
  const inviterId = raw.replace(/^"+|"+$/g, '')
  if (!inviterId || inviterId === newUserId || !/^\d+$/.test(inviterId)) return null

  await kvRequest(`set/ref:by:${newUserId}/${encodeURIComponent(inviterId)}`, 'POST')
  await kvRequest(`sadd/ref:list:${inviterId}/${newUserId}`, 'POST')
  await kvRequest(`incr/ref:count:${inviterId}`, 'POST')
  await kvRequest(`del/ref:pending:${newUserId}`, 'POST')

  return inviterId
}

/**
 * Сколько подтверждённых приглашений у юзера.
 */
export const getReferralCount = async (inviterId: string): Promise<number> => {
  const raw = await kvRequest(`get/ref:count:${inviterId}`)
  if (!raw) return 0
  const n = Number(typeof raw === 'string' ? raw : raw)
  return Number.isFinite(n) ? n : 0
}

// ============================================================================
// Pending транзакции из бота (распознанные фразы)
// ============================================================================
//
// Юзер шлёт боту «такси 500», бот парсит, подтверждает, кладёт в KV.
// Mini App при открытии забирает через /api/bot/pending и предлагает добавить.

export interface PendingTx {
  id: string                    // уникальный id (timestamp)
  amount: number
  type: 'expense' | 'income'
  categoryGuess: string
  merchant?: string
  currency: string
  comment?: string
  date: string                  // ISO
  createdAt: string             // ISO когда попало в KV
  source: 'text' | 'voice'
  rawText: string               // оригинальная фраза
}

export const addPendingTx = async (
  telegramId: string,
  tx: PendingTx,
): Promise<void> => {
  // Храним массив; limit 20 последних
  const existing = await getPendingTxList(telegramId)
  const next = [tx, ...existing].slice(0, 20)
  await kvRequest(
    `set/pending_tx:${telegramId}`,
    'POST',
    JSON.stringify(next),
  )
  // TTL 30 дней
  await kvRequest(`expire/pending_tx:${telegramId}/2592000`, 'POST').catch(() => {})
}

export const getPendingTxList = async (telegramId: string): Promise<PendingTx[]> => {
  const raw = await kvRequest(`get/pending_tx:${telegramId}`)
  if (!raw) return []
  try {
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export const removePendingTx = async (
  telegramId: string,
  txId: string,
): Promise<void> => {
  const existing = await getPendingTxList(telegramId)
  const next = existing.filter((t) => t.id !== txId)
  if (next.length === 0) {
    await kvRequest(`del/pending_tx:${telegramId}`, 'POST').catch(() => {})
  } else {
    await kvRequest(
      `set/pending_tx:${telegramId}`,
      'POST',
      JSON.stringify(next),
    )
  }
}
