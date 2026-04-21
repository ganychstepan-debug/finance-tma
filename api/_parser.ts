/**
 * Парсер фраз вроде «такси 500» → структурированная транзакция.
 * Используется в боте, когда юзер шлёт текст/голос.
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export interface ParsedExpense {
  amount: number
  type: 'expense' | 'income'
  categoryGuess: string        // название категории по-русски, которое потом матчится с пользовательскими
  merchant?: string             // магазин/контекст (короткое слово)
  currency?: string             // RUB/USD/EUR/... если явно указано
  comment?: string              // доп. комментарий
  daysAgo?: number              // 0 = сегодня, 1 = вчера и т.д.
  confidence: 'high' | 'medium' | 'low'
}

const SYSTEM_PROMPT = `Ты парсер коротких фраз о тратах/доходах на русском для приложения учёта финансов.

Вернёшь ТОЛЬКО JSON в формате:
{
  "amount": 0,
  "type": "expense",
  "categoryGuess": "",
  "merchant": "",
  "currency": "",
  "comment": "",
  "daysAgo": 0,
  "confidence": "high"
}

Правила:
- amount — число. Суммы с буквами: "1к" = 1000, "3к" = 3000, "2.5к" = 2500, "1.5лям" = 1500000
- type — "expense" если трата/потратил/купил/заплатил, "income" если зарплата/доход/получил/вернули
- categoryGuess — одно из: Еда, Транспорт, Дом, Развлечения, Одежда, Здоровье, Поездки, Связь, Подарки, Спорт, Образование, Подписки, Зарплата, Другое
- merchant — ключевое слово из фразы (перрон, пятёрочка, такси, салон). 1-2 слова. Пусто если неясно.
- currency — RUB (по умолчанию если не указано), USD, EUR, KZT, BYN, UAH и т.п.
- comment — дополнительный контекст из фразы, пусто если нет
- daysAgo — 0 = сегодня, 1 = вчера/"вчера", 2 = позавчера. Если дата не указана — 0
- confidence — "high" если всё ясно, "medium" если догадка, "low" если мутно

Примеры:
"такси 500" → {"amount":500,"type":"expense","categoryGuess":"Транспорт","merchant":"такси","currency":"RUB","comment":"","daysAgo":0,"confidence":"high"}
"вчера купил шоколадку за 120" → {"amount":120,"type":"expense","categoryGuess":"Еда","merchant":"шоколад","currency":"RUB","comment":"","daysAgo":1,"confidence":"high"}
"зарплата 80к" → {"amount":80000,"type":"income","categoryGuess":"Зарплата","merchant":"","currency":"RUB","comment":"","daysAgo":0,"confidence":"high"}
"обед в кафе 1500" → {"amount":1500,"type":"expense","categoryGuess":"Еда","merchant":"кафе","currency":"RUB","comment":"обед","daysAgo":0,"confidence":"high"}
"20 долларов за игру" → {"amount":20,"type":"expense","categoryGuess":"Развлечения","merchant":"","currency":"USD","comment":"игра","daysAgo":0,"confidence":"high"}

Только JSON, без текста вокруг.`

export const parseExpensePhrase = async (phrase: string): Promise<ParsedExpense | null> => {
  const list = await parseExpensePhrases(phrase)
  return list[0] ?? null
}

/**
 * Массовый парсер: извлекает ВСЕ операции из текста.
 * "купил кофе 300, зарплата 80к, такси 500" → 3 операции.
 */
export const parseExpensePhrases = async (phrase: string): Promise<ParsedExpense[]> => {
  const apiKey = (globalThis as any).process?.env?.OPENAI_API_KEY
    ?? (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined)

  if (!apiKey) throw new Error('OPENAI_API_KEY не настроен')

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BULK_SYSTEM_PROMPT },
        { role: 'user', content: phrase },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return []

  try {
    const obj = JSON.parse(text)
    const arr = Array.isArray(obj?.operations) ? obj.operations : []
    return arr
      .map((p: any): ParsedExpense | null => {
        const amount = Number(p?.amount) || 0
        // v0.67: amount может быть 0 — значит сумма не указана, всё равно создаём операцию
        // Но нужен хоть какой-то контекст — категория или merchant
        const cat = String(p?.categoryGuess ?? '').trim()
        const merch = String(p?.merchant ?? '').trim()
        if (amount <= 0 && !cat && !merch) return null
        return {
          amount,
          type: p?.type === 'income' ? 'income' : 'expense',
          categoryGuess: cat.slice(0, 40) || 'Другое',
          merchant: merch ? merch.slice(0, 40) : undefined,
          currency: p?.currency ? String(p.currency).trim().toUpperCase().slice(0, 4) : 'RUB',
          comment: p?.comment ? String(p.comment).trim().slice(0, 140) : undefined,
          daysAgo: Math.max(0, Math.min(30, Number(p?.daysAgo) || 0)),
          confidence: ['high', 'medium', 'low'].includes(p?.confidence) ? p.confidence : 'medium',
        }
      })
      .filter((x: ParsedExpense | null): x is ParsedExpense => x !== null)
  } catch {
    return []
  }
}

const BULK_SYSTEM_PROMPT = `Ты парсер финансовых операций на русском. Юзер пишет одну или НЕСКОЛЬКО операций в одном сообщении.

Вернёшь JSON:
{
  "operations": [
    {"amount":0,"type":"expense","categoryGuess":"","merchant":"","currency":"RUB","comment":"","daysAgo":0,"confidence":"high"}
  ]
}

Правила:
- amount — число. "1к"=1000, "3к"=3000, "2.5к"=2500, "1.5лям"=1500000. ЕСЛИ СУММА НЕ УКАЗАНА — ставь amount:0 (но всё равно возвращай операцию если есть категория/контекст).
- type — "expense" (трата/купил/заплатил) или "income" (зарплата/получил/вернули)
- categoryGuess — одно из: Еда, Транспорт, Дом, Развлечения, Одежда, Здоровье, Поездки, Связь, Подарки, Спорт, Образование, Подписки, Зарплата, Другое
- merchant — 1-2 слова (пятёрочка, такси, салон) или пусто
- currency — RUB (по умолчанию), USD, EUR, KZT и т.п.
- comment — КРАТКОЕ описание операции из контекста фразы (что именно, где, зачем). Например: "обед с коллегами", "такси домой", "на заправке". НЕ повторяй категорию. До 140 символов. Пусто если контекста нет.
- daysAgo — 0 сегодня, 1 вчера, 2 позавчера
- confidence — "high"/"medium"/"low". Ставь "low" если amount=0.

ВАЖНО: в operations должен быть массив из ВСЕХ упомянутых операций. Разделители: запятая, "и", "плюс", "потом", перевод строки. Для каждой операции составляй уникальный comment.

Примеры:
"такси 500" → {"operations":[{"amount":500,"type":"expense","categoryGuess":"Транспорт","merchant":"такси","currency":"RUB","comment":"","daysAgo":0,"confidence":"high"}]}

"обед в кафе с другом 1500" → {"operations":[{"amount":1500,"type":"expense","categoryGuess":"Еда","merchant":"кафе","currency":"RUB","comment":"обед с другом","daysAgo":0,"confidence":"high"}]}

"купил продукты" (без суммы) → {"operations":[{"amount":0,"type":"expense","categoryGuess":"Еда","merchant":"продукты","currency":"RUB","comment":"покупка продуктов","daysAgo":0,"confidence":"low"}]}

"вчера кофе 300 и сегодня обед на заправке 800" → {"operations":[
  {"amount":300,"type":"expense","categoryGuess":"Еда","merchant":"кофе","currency":"RUB","comment":"кофе с утра","daysAgo":1,"confidence":"high"},
  {"amount":800,"type":"expense","categoryGuess":"Еда","merchant":"заправка","currency":"RUB","comment":"обед на заправке","daysAgo":0,"confidence":"high"}
]}

"купил кофе 300 и потратил на такси 500, зарплата 80к" → {"operations":[
  {"amount":300,"type":"expense","categoryGuess":"Еда","merchant":"кофе","currency":"RUB","comment":"кофе","daysAgo":0,"confidence":"high"},
  {"amount":500,"type":"expense","categoryGuess":"Транспорт","merchant":"такси","currency":"RUB","comment":"такси","daysAgo":0,"confidence":"high"},
  {"amount":80000,"type":"income","categoryGuess":"Зарплата","merchant":"","currency":"RUB","comment":"зарплата","daysAgo":0,"confidence":"high"}
]}

Только JSON, без текста вокруг.`
