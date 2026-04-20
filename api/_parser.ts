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
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
  if (typeof text !== 'string') return null

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0])
    const amount = Number(parsed?.amount) || 0
    if (amount <= 0) return null

    return {
      amount,
      type: parsed?.type === 'income' ? 'income' : 'expense',
      categoryGuess: String(parsed?.categoryGuess ?? 'Другое').trim().slice(0, 40),
      merchant: parsed?.merchant ? String(parsed.merchant).trim().slice(0, 40) : undefined,
      currency: parsed?.currency ? String(parsed.currency).trim().toUpperCase().slice(0, 4) : 'RUB',
      comment: parsed?.comment ? String(parsed.comment).trim().slice(0, 80) : undefined,
      daysAgo: Math.max(0, Math.min(30, Number(parsed?.daysAgo) || 0)),
      confidence: ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'medium',
    }
  } catch {
    return null
  }
}
