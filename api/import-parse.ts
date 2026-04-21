/**
 * POST /api/import-parse
 *
 * AI-fallback парсер: когда хардкод-детектор не распознал формат файла,
 * отдаём текст в GPT — он превращает в стандартный ImportRow[].
 *
 * Принимает: { text: string, accounts: [{id,name}], categories: [{id,name,type}] }
 * Возвращает: { rows: ImportRow[], detectedFormat: string, errors: string[] }
 */

import {
  checkRateLimit,
  extractUserId,
  json,
  corsPreflight,
} from './_shared'

export const config = { runtime: 'edge' }

interface Ref { id: string; name: string; type?: string }

const buildPrompt = (text: string, accounts: Ref[], categories: Ref[]): string => {
  const accList = accounts.map((a) => `- ${a.name}`).join('\n') || '(нет)'
  const expCats = categories.filter((c) => c.type === 'expense').map((c) => `- ${c.name}`).join('\n') || '(нет)'
  const incCats = categories.filter((c) => c.type === 'income').map((c) => `- ${c.name}`).join('\n') || '(нет)'
  const trimmed = text.length > 40000 ? text.slice(0, 40000) + '\n...[обрезано]' : text

  return `Ты парсер финансовых выписок. Данные ЛЮБОГО формата превращаешь в единый JSON.

Верни СТРОГО JSON:
{
  "detectedFormat": "",
  "rows": [
    { "date": "YYYY-MM-DD", "type": "expense", "amount": 0, "currency": "RUB", "accountName": "", "categoryName": "", "comment": "" }
  ],
  "errors": []
}

ПРАВИЛА:
- detectedFormat — Дзен-мани / CoinKeeper / Monefy / Money Manager / Money Lover / 1Money / YNAB / Тинькофф / Сбер / Альфа / Неизвестный
- type: "expense" (трата) / "income" (доход) / "transfer" (перевод)
- amount — всегда положительное число без знака
- currency — RUB / USD / EUR / ... (распознавай ₽/$/€)
- accountName — максимально сопоставь с именами счетов юзера (см. ниже), иначе бери из файла
- categoryName — максимально сопоставь с категориями юзера, иначе из файла
- date — YYYY-MM-DD (формат DD.MM.YYYY, DD/MM/YYYY, ISO с временем — всё понимай)
- comment — контрагент/описание/место до 140 символов
- Пропускай строки: заголовок, итоги, пустые, явные дубли перевода
- В errors — краткие пояснения ошибок (до 5 штук)

СЧЕТА ЮЗЕРА:
${accList}

КАТЕГОРИИ (РАСХОД):
${expCats}

КАТЕГОРИИ (ДОХОД):
${incCats}

ДАННЫЕ (любой формат — CSV/TSV/текст):
\`\`\`
${trimmed}
\`\`\`

Максимум 500 строк в rows. Только JSON, без текста вокруг.`
}

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

const callOpenAI = async (prompt: string): Promise<string> => {
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
      max_tokens: 6000,
      temperature: 0.05,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Ты парсер табличных финансовых данных. Возвращаешь только валидный JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('OpenAI вернул неожиданный формат')
  return text.trim()
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return corsPreflight()
  if (req.method !== 'POST') return json({ error: 'Only POST allowed' }, 405)

  const userId = extractUserId(req.headers.get('x-telegram-init-data') || '')
  const rl = checkRateLimit(userId)
  if (!rl.ok) return json({ error: rl.reason }, 429)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Невалидный JSON' }, 400)
  }

  const text = String(body?.text ?? '').trim()
  const accounts: Ref[] = Array.isArray(body?.accounts) ? body.accounts : []
  const categories: Ref[] = Array.isArray(body?.categories) ? body.categories : []

  if (!text) return json({ error: 'Нет данных для парсинга' }, 400)
  if (text.length > 500_000) return json({ error: 'Файл слишком большой (макс ~500 КБ)' }, 400)

  try {
    const prompt = buildPrompt(text, accounts, categories)
    const response = await callOpenAI(prompt)

    let parsed: any
    try {
      parsed = JSON.parse(response)
    } catch {
      console.error('AI import: bad JSON:', response.slice(0, 300))
      return json({ error: 'Не удалось распарсить ответ ИИ' }, 502)
    }

    const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : []
    const errors = Array.isArray(parsed?.errors) ? parsed.errors.slice(0, 10) : []
    const detectedFormat = String(parsed?.detectedFormat ?? 'Неизвестный')

    // Валидация строк
    const rows = rawRows
      .map((r: any) => {
        const date = String(r?.date ?? '').trim()
        if (!date) return null
        const d = new Date(date)
        if (isNaN(d.getTime())) return null
        const type = ['expense', 'income', 'transfer'].includes(r?.type) ? r.type : 'expense'
        const amount = Number(r?.amount) || 0
        if (amount <= 0) return null
        return {
          date: d.toISOString(),
          type,
          amount,
          currency: String(r?.currency ?? 'RUB').toUpperCase().slice(0, 4),
          accountName: String(r?.accountName ?? '').trim().slice(0, 60),
          categoryName: String(r?.categoryName ?? '').trim().slice(0, 60),
          comment: r?.comment ? String(r.comment).trim().slice(0, 200) : undefined,
        }
      })
      .filter((x: any) => x !== null)

    if (rows.length === 0) {
      return json({ rows: [], errors: ['ИИ не смог распознать ни одной строки', ...errors], detectedFormat }, 200)
    }

    return json({ rows, errors, detectedFormat })
  } catch (e) {
    const msg = (e as Error).message
    console.error('AI import error:', msg)
    return json({ error: 'ИИ временно недоступен, попробуй ещё раз' }, 502)
  }
}
