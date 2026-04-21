/**
 * POST /api/receipt-scan
 *
 * Принимает JSON: { imageBase64: "iVBORw0K...", categories: [{id, name}] }
 * Возвращает: { amount, merchant, date, categoryGuess, categoryId? }
 *
 * Gemini Vision читает фото чека, извлекает сумму, магазин, дату.
 * Пытается угадать категорию из предоставленного списка.
 */

import {
  checkRateLimit,
  extractUserId,
  json,
  corsPreflight,
  moderateInput,
} from './_shared'

export const config = { runtime: 'edge' }

const GEMINI_VISION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface ReceiptCategory {
  id: string
  name: string
}

const buildPrompt = (categories: ReceiptCategory[]): string => {
  const catList = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
  return `Ты распознаёшь данные с фото российского кассового чека.

Верни ТОЛЬКО JSON в формате:
{
  "amount": 0,
  "merchant": "",
  "date": "YYYY-MM-DD",
  "categoryName": ""
}

Правила:
- amount — итоговая сумма чека (ИТОГО / К ОПЛАТЕ) в рублях, число
- merchant — название магазина/заведения (короткое, 1-3 слова)
- date — дата покупки в формате YYYY-MM-DD, если не видно — сегодняшняя
- categoryName — подбери САМУЮ подходящую категорию из списка ниже, верни её точное название
- Если чек нечитаемый или это не чек — верни {"amount": 0, "merchant": "", "date": "", "categoryName": ""}
- Не добавляй никакого текста вокруг JSON, только сам JSON

Доступные категории:
${catList}`
}

const callGeminiVision = async (prompt: string, imageBase64: string): Promise<string> => {
  const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY
    ?? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined)

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не настроен')
  }

  const mimeType = imageBase64.startsWith('/9j/') ? 'image/jpeg'
    : imageBase64.startsWith('iVBOR') ? 'image/png'
    : 'image/jpeg'

  const res = await fetch(`${GEMINI_VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini Vision ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Gemini вернул неожиданный формат')
  }
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

  const imageBase64 = String(body?.imageBase64 ?? '').trim()
  const categories: ReceiptCategory[] = Array.isArray(body?.categories) ? body.categories : []

  if (!imageBase64) {
    return json({ error: 'Нужно фото чека' }, 400)
  }
  if (imageBase64.length > 2_500_000) {
    return json({ error: 'Фото слишком большое (макс ~2 МБ)' }, 400)
  }
  if (categories.length === 0) {
    return json({ error: 'Нет категорий для классификации' }, 400)
  }

  // Модерация названий категорий (вдруг юзер обошёл клиент)
  for (const c of categories) {
    if (!moderateInput(c.name).ok) {
      return json({ error: 'Запрещённые названия категорий', blocked: true }, 403)
    }
  }

  try {
    const prompt = buildPrompt(categories)
    const response = await callGeminiVision(prompt, imageBase64)

    // Gemini иногда оборачивает JSON в ```json ... ``` даже при responseMimeType.
    const cleaned = response
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Receipt scan: bad JSON from Gemini:', response.slice(0, 300))
      return json({ error: 'Не удалось распознать чек, попробуй переснять' }, 502)
    }

    const amount = Number(parsed?.amount) || 0
    const merchant = String(parsed?.merchant ?? '').trim().slice(0, 60)
    const date = String(parsed?.date ?? '').trim()
    const categoryName = String(parsed?.categoryName ?? '').trim()

    // Находим id категории по имени
    const matched = categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    )

    if (amount <= 0) {
      return json({
        error: 'Не удалось прочитать сумму с чека',
        fallback: true,
      }, 422)
    }

    return json({
      amount,
      merchant,
      date: date || new Date().toISOString().slice(0, 10),
      categoryId: matched?.id,
      categoryName: matched?.name || categoryName,
    })
  } catch (e) {
    const msg = (e as Error).message
    console.error('Receipt scan error:', msg)
    return json({ error: 'ИИ временно недоступен, попробуй ещё раз' }, 502)
  }
}
