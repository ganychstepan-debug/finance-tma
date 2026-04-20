/**
 * Общая инфраструктура для /api/ai/* эндпоинтов.
 *
 * - Rate limit по user.id из Telegram initData (10/мин, 50/день).
 * - Валидация initData (проверяем что запрос пришёл от реального юзера TG).
 * - In-memory счётчики: для беты хватит, на проде надо будет KV.
 *
 * Runtime: Edge (Web Fetch API, без Node.js).
 */

export const config = { runtime: 'edge' }

// ============================================================================
// Rate limit (in-memory)
// ============================================================================

// Важно: Edge runtime на Vercel может крутить несколько инстансов, счётчики
// будут локальные для каждого инстанса. Для беты с 10 юзерами это ок —
// по факту лимиты будут чуть мягче чем настроены, но защита от спама есть.

type Bucket = { count: number; resetAt: number }
const minuteBuckets = new Map<string, Bucket>()
const dayBuckets = new Map<string, Bucket>()

const MINUTE_LIMIT = 10
const DAY_LIMIT = 50

export const checkRateLimit = (userId: string): { ok: true } | { ok: false; reason: string } => {
  const now = Date.now()

  // Минутный лимит
  const mb = minuteBuckets.get(userId)
  if (!mb || mb.resetAt < now) {
    minuteBuckets.set(userId, { count: 1, resetAt: now + 60_000 })
  } else {
    mb.count += 1
    if (mb.count > MINUTE_LIMIT) {
      return { ok: false, reason: 'Слишком часто — попробуй через минуту' }
    }
  }

  // Дневной лимит
  const db = dayBuckets.get(userId)
  if (!db || db.resetAt < now) {
    dayBuckets.set(userId, { count: 1, resetAt: now + 86_400_000 })
  } else {
    db.count += 1
    if (db.count > DAY_LIMIT) {
      return { ok: false, reason: 'Лимит на сегодня исчерпан — продолжим завтра' }
    }
  }

  return { ok: true }
}

// ============================================================================
// Извлечение user.id из Telegram initData
// ============================================================================

/**
 * Парсит query-string initData и достаёт user.id.
 * БЕЗ криптографической проверки подписи (нужен BOT_TOKEN и более сложный код).
 * Для беты достаточно — анонимные запросы всё равно получат user.id='anon' и
 * попадут в общий лимит.
 *
 * Полноценная проверка hash будет в Sprint 4.2 когда появится бэкенд с BOT_TOKEN.
 */
export const extractUserId = (initData: string | null): string => {
  if (!initData) return 'anon'
  try {
    const params = new URLSearchParams(initData)
    const userJson = params.get('user')
    if (!userJson) return 'anon'
    const user = JSON.parse(userJson)
    if (user?.id && typeof user.id === 'number') {
      return String(user.id)
    }
    return 'anon'
  } catch {
    return 'anon'
  }
}

// ============================================================================
// Криптографическая проверка initData (HMAC-SHA256)
// ============================================================================

/**
 * Проверяет подпись initData и возвращает верифицированные данные юзера.
 * Защита от накруток реферальной программы — без валидной подписи от Telegram
 * запрос не принимается.
 *
 * Док: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export interface VerifiedUser {
  id: string
  firstName?: string
  username?: string
}

export const verifyInitData = async (
  initData: string | null,
): Promise<VerifiedUser | null> => {
  if (!initData) return null
  const botToken = (globalThis as any).process?.env?.BOT_TOKEN
    ?? (typeof process !== 'undefined' ? process.env?.BOT_TOKEN : undefined)
  if (!botToken) return null

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null
    params.delete('hash')

    // Собираем data-check-string: отсортированные key=value через \n
    const pairs: string[] = []
    for (const [k, v] of Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      pairs.push(`${k}=${v}`)
    }
    const dataCheckString = pairs.join('\n')

    // По спеке Telegram:
    //   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
    //   hash       = HMAC_SHA256(key = secret_key,   data = data_check_string)
    const enc = new TextEncoder()
    const webAppKey = await crypto.subtle.importKey(
      'raw', enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const secret = await crypto.subtle.sign('HMAC', webAppKey, enc.encode(botToken))

    const sigKey = await crypto.subtle.importKey(
      'raw', secret,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', sigKey, enc.encode(dataCheckString))

    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (computed !== hash) {
      console.warn('initData hash mismatch', { computed: computed.slice(0, 8), got: hash.slice(0, 8) })
      return null
    }

    // auth_date не старше 7 дней (для не-залогиненных Mini App может быть долго)
    const authDate = Number(params.get('auth_date') ?? 0)
    if (!authDate || Date.now() / 1000 - authDate > 7 * 86400) return null

    const userJson = params.get('user')
    if (!userJson) return null
    const user = JSON.parse(userJson)
    if (!user?.id) return null

    return {
      id: String(user.id),
      firstName: user.first_name,
      username: user.username,
    }
  } catch (e) {
    console.error('verifyInitData error:', (e as Error).message)
    return null
  }
}

// ============================================================================
// Вызов Gemini
// ============================================================================

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

export interface GeminiRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
}

export const callGemini = async ({
  prompt,
  maxTokens = 100,
  temperature = 0.3,
}: GeminiRequest): Promise<string> => {
  const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY
    ?? (globalThis as any).GEMINI_API_KEY
    ?? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined)

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не настроен на сервере')
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Gemini вернул неожиданный формат ответа')
  }
  return text.trim()
}

// ============================================================================
// CORS / JSON helpers
// ============================================================================

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
    },
  })

export const corsPreflight = (): Response =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
    },
  })

// ============================================================================
// Серверная модерация
// ============================================================================
// Продублирован минимальный набор стоп-слов (Edge runtime не может импортить из src/).
// Фильтрует то же самое что клиент + плюс защита от обхода.

const LATIN_TO_CYR: Record<string, string> = {
  a:'а', b:'б', c:'с', d:'д', e:'е', f:'ф', g:'г', h:'х', i:'и', j:'ж',
  k:'к', l:'л', m:'м', n:'н', o:'о', p:'п', q:'к', r:'р', s:'с', t:'т',
  u:'у', v:'в', w:'в', x:'х', y:'у', z:'з',
}
const DIG_TO_LET: Record<string, string> = {
  '0':'о', '1':'и', '3':'е', '4':'ч', '6':'б', '7':'т', '8':'в', '9':'д',
}

const normalizeForCheck = (text: string): string => {
  let s = text.toLowerCase()
  s = s.replace(/[a-z]/g, (c) => LATIN_TO_CYR[c] || c)
  s = s.replace(/[013467890]/g, (c) => DIG_TO_LET[c] || c)
  s = s.replace(/[^а-яё]/g, '')
  return s
}

const STOP_ROOTS = [
  // Насилие и оружие
  'оруж','пистол','револьвер','автомат','винтовк','гранат','взрывчат','бомба','бомбу','снаряд','патрон','глушител','ружь','карабин','пулемёт','пулемет','калашник',
  'наркот','нарка','нарку','кокаин','героин','метадон','амфетамин','мефедрон','лсд','экстази','марихуан','конопл','гашиш','травка','травы','травку','шишки','дурь','спайс','синтет','закладк','трип','приход',
  'убийств','убить','убью','убил','расстрел','пытк','избиен','изнасил','насилов','суицид','самоубийств','повес','застрел',
  'терак','террор','экстрем','джихад','игил','талибан','боевик',
  // Сексуальное
  'порно','порнуш','эрот','секси','хентай','проститут','шлюх','путан','эскорт','минет','куни','анал','оргазм','мастурб','онанизм','дрочк','пенис','вагин','интим',
  // Незаконное
  'взятк','откат','подкуп','коррупц','отмыван','отмыть','обнал','обналич','подделк','фальшив','контрафакт','контрабанд','хакер','хакнуть','взломат','фишинг','кардинг','пират','ворован','уклонен',
  // Ненависть
  'нацист','фашист','свастик','зигу','хайльгитл','негр','нигер','хачи','хач','черножоп','чурк','жидов','хохол','хохл','москал','кацап',
  'хуй','хуе','хуя','хую','пизд','ебат','ебал','ебан','ебу','бляд','пидар','пидор','гандон','мудак','мудил','сука','суку','суки','далбо','долбо','еблан',
  // CSAM
  'педофил','педик','лолит','шота','малолет','детскоепорн','несовершеннолетн','ребёноксекс','ребеноксекс','детисекс',
  // Prompt injection
  'игнорир','забудьинстр','забудьправ','системныйпром','промптсист','покажипром','тытепер','представьсебя','тыбудешь','сыграйрол','обойдифил','безфильт','безцензур','джейлбрек','джейлбрейк',
  // Политика
  'путин','путен','медведев','шойгу','зеленск','байден','трамп','обам','лукашенк','эрдоган','макрон','шольц','свопераци','войнаукр','мобилизац','едросс','кпрф','лдпр','навальн','фбк','аннекс','оккупац',
]

export const moderateInput = (text: string): { ok: boolean; matchedRoot?: string } => {
  if (!text || text.trim().length === 0) return { ok: true }
  const normalized = normalizeForCheck(text)
  if (normalized.length < 2) return { ok: true }
  for (const root of STOP_ROOTS) {
    if (normalized.includes(root)) {
      return { ok: false, matchedRoot: root }
    }
  }
  return { ok: true }
}
