/**
 * POST /api/receipt-scan
 *
 * v0.87: расширенный формат ответа.
 * Принимает: { imageBase64, categories: [{id, name}] }
 * Возвращает: {
 *   amount: number,         // итог чека (ИТОГО К ОПЛАТЕ — после всех скидок)
 *   subtotal?: number,      // подытог ДО скидок
 *   discount?: number,      // сумма скидок
 *   merchant: string,
 *   date: string,           // YYYY-MM-DD
 *   items: [{ name, price, categoryName }],   // позиции с категориями
 *   byCategory: [{ categoryName, categoryId?, total }],
 *   categoryId?: string,    // ID самой крупной категории
 *   categoryName?: string,
 *   confidence: 'high' | 'medium' | 'low',
 *   warning?: string
 * }
 */

import {
  checkRateLimit,
  extractUserId,
  json,
  corsPreflight,
  moderateInput,
} from './_shared'

export const config = { runtime: 'edge' }

interface ReceiptCategory {
  id: string
  name: string
}

const buildPrompt = (categories: ReceiptCategory[]): string => {
  const catList = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
  return `Ты распознаёшь данные с фото российского кассового чека.

Верни СТРОГО JSON:
{
  "amount": 0,
  "subtotal": 0,
  "discount": 0,
  "merchant": "",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "", "price": 0, "categoryName": "" }
  ],
  "confidence": "high"
}

КАК ИЗВЛЕКАТЬ СУММУ (САМОЕ ВАЖНОЕ):
1. ГЛАВНЫЙ приоритет — строка "ИТОГ" / "ИТОГО" / "К ОПЛАТЕ" / "К ОПЛ." — это финальная сумма после всех скидок. Именно она в amount.
2. "ПОДЫТОГ" / "ИТОГ БЕЗ СКИДКИ" — это сумма ДО скидок, клади её в subtotal.
3. "СКИДКА НА ЧЕК" / "СКИДКА ПО КАРТЕ" — разница между подытогом и итогом, клади в discount.
4. Если видишь "БЕЗНАЛИЧНЫМИ" или "СУММА (Руб)" после "ОДОБРЕНО" — это тоже итоговая сумма.
5. ПРОВЕРЬ: amount должно быть МЕНЬШЕ или РАВНО subtotal. Если наоборот — ты перепутал, исправь.
6. НЕ суммируй позиции сам чтобы получить amount. Ищи строку итога. Сложение позиций — только последний fallback.

КАК ИЗВЛЕКАТЬ ПОЗИЦИИ (items):
- Каждая купленная позиция = один элемент items
- name — название товара ДОСЛОВНО КАК НАПИСАНО В ЧЕКЕ. НЕ перефразируй, НЕ расшифровывай аббревиатуры, НЕ добавляй свои слова. Просто переноси текст из строки чека до 30 символов. Примеры: "SNICK.Бат.SUP.шок." так и пиши; "Огурцы среднеплодные 1кг" так и пиши; "Молоко Простоквашино 1л" так и пиши. Можно убирать коды, артикулы, цифры НДС, штрих-коды. Но сами названия товаров — один в один.
- price — финальная стоимость этой позиции в чеке (колонка "Итого" по позиции, с учётом количества)
- categoryName — подбери из списка доступных категорий (см. ниже) САМУЮ подходящую для этой позиции
- Если позиций больше 20 — оставь как есть, все в items. Не группируй похожие в одну строку, не создавай обобщённые названия вроде "Молочка" или "Снеки".

ОБЩЕЕ:
- merchant — название магазина (Пятёрочка, Магнит, Ашан, Кафе Ромашка и т.п.)
- date — дата покупки YYYY-MM-DD; если не видно — сегодня
- confidence: "high" если чек чёткий и ИТОГ точно виден; "medium" если что-то смазано но основное читаемо; "low" если фото плохое, сумма итога не видна, или ты считал сумму сам
- Если не чек или не читается: { "amount": 0, "items": [], "confidence": "low" }

Доступные категории для items.categoryName и итоговой:
${catList}

Только JSON. Никакого текста вокруг.`
}

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

const callOpenAiVision = async (prompt: string, imageBase64: string): Promise<string> => {
  const apiKey = (globalThis as any).process?.env?.OPENAI_API_KEY
    ?? (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined)

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не настроен')
  }

  const mimeType = imageBase64.startsWith('/9j/') ? 'image/jpeg'
    : imageBase64.startsWith('iVBOR') ? 'image/png'
    : 'image/jpeg'

  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // v0.87: gpt-4o (не mini) для чтения мелкого текста чеков + detail:high
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0.05,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI Vision ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new Error('OpenAI вернул неожиданный формат')
  }
  return text.trim()
}

interface ReceiptItem {
  name: string
  price: number
  categoryName: string
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
  if (imageBase64.length > 5_500_000) {
    return json({ error: 'Фото слишком большое (макс ~4 МБ)' }, 400)
  }
  if (categories.length === 0) {
    return json({ error: 'Нет категорий для классификации' }, 400)
  }

  for (const c of categories) {
    if (!moderateInput(c.name).ok) {
      return json({ error: 'Запрещённые названия категорий', blocked: true }, 403)
    }
  }

  try {
    const prompt = buildPrompt(categories)
    const response = await callOpenAiVision(prompt, imageBase64)

    const cleaned = response
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Receipt scan: bad JSON from OpenAI:', response.slice(0, 300))
      return json({ error: 'Не удалось распознать чек, попробуй переснять' }, 502)
    }

    let amount = Number(parsed?.amount) || 0
    const subtotal = Number(parsed?.subtotal) || 0
    const discount = Number(parsed?.discount) || 0
    const merchant = String(parsed?.merchant ?? '').trim().slice(0, 60)
    const date = String(parsed?.date ?? '').trim()
    let confidence: 'high' | 'medium' | 'low' =
      ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'medium'

    const rawItems: any[] = Array.isArray(parsed?.items) ? parsed.items : []
    const items: ReceiptItem[] = rawItems
      .map((it) => {
        const name = String(it?.name ?? '').trim().slice(0, 40)
        const price = Number(it?.price) || 0
        const categoryName = String(it?.categoryName ?? '').trim()
        if (!name || price <= 0) return null
        return { name, price, categoryName }
      })
      .filter((x): x is ReceiptItem => x !== null)

    // Sanity check: amount должно быть <= subtotal (если оба видны)
    if (subtotal > 0 && amount > subtotal) {
      const tmp = amount
      amount = subtotal
      confidence = 'low'
      console.warn('Receipt scan: swapped subtotal<->amount', tmp, subtotal)
    }

    // v0.88: warning убран из UI; внутренне только меняем confidence если sanity-check сработал
    if (items.length > 0 && amount > 0) {
      const itemsTotal = items.reduce((s, i) => s + i.price, 0)
      const diff = Math.abs(itemsTotal - amount)
      if (diff > 10 && diff / amount > 0.02) {
        const expectedDiff = discount > 0 ? Math.abs((itemsTotal - discount) - amount) : diff
        if (expectedDiff > 10) {
          if (confidence === 'high') confidence = 'medium'
        }
      }
    }

    // Группировка по категориям
    // v0.89: fuzzy matching — точное совпадение → частичное → первая по типу расход
    const fuzzyMatch = (guess: string): ReceiptCategory | undefined => {
      const needle = guess.toLowerCase().trim()
      if (!needle) return undefined
      let m = categories.find((c) => c.name.toLowerCase() === needle)
      if (m) return m
      m = categories.find((c) => {
        const n = c.name.toLowerCase()
        return n.includes(needle) || needle.includes(n)
      })
      return m
    }

    const byCatMap = new Map<string, number>()
    for (const it of items) {
      const key = it.categoryName || 'Другое'
      byCatMap.set(key, (byCatMap.get(key) || 0) + it.price)
    }
    const byCategory = Array.from(byCatMap.entries())
      .map(([categoryName, total]) => {
        const matched = fuzzyMatch(categoryName) ?? categories[0]
        return {
          categoryName: matched?.name || categoryName,
          categoryId: matched?.id,
          total: Math.round(total * 100) / 100,
        }
      })
      .sort((a, b) => b.total - a.total)

    const topCat = byCategory[0]
    const categoryId = topCat?.categoryId
    const categoryName = topCat?.categoryName

    if (amount <= 0) {
      return json({
        error: 'Не удалось прочитать сумму с чека',
        fallback: true,
      }, 422)
    }

    return json({
      amount,
      subtotal: subtotal || undefined,
      discount: discount || undefined,
      merchant,
      date: date || new Date().toISOString().slice(0, 10),
      items,
      byCategory,
      categoryId,
      categoryName,
      confidence,
    })
  } catch (e) {
    const msg = (e as Error).message
    console.error('Receipt scan error:', msg)
    return json({ error: 'ИИ временно недоступен, попробуй ещё раз' }, 502)
  }
}
