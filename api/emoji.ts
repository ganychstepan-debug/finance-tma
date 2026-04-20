/**
 * POST /api/emoji
 *
 * Принимает JSON: { description: "коктейли на пляже" }
 * Возвращает: { emoji: "🍹" }
 *
 * Юзер в приложении пишет описание → Gemini подбирает одно подходящее эмодзи.
 */

import {
  checkRateLimit,
  extractUserId,
  callGemini,
  json,
  corsPreflight,
  moderateInput,
} from './_shared'

export const config = { runtime: 'edge' }

// Извлекает первый эмодзи из произвольного текста.
// Gemini может вернуть "🍹" или "Коктейль: 🍹" или "🍹 🏖️".
// Берём только первый валидный эмодзи-символ.
const extractFirstEmoji = (text: string): string | null => {
  // Emoji diapasons — охватывает большинство эмодзи символов
  const emojiRegex = /(\p{Extended_Pictographic})/u
  const match = text.match(emojiRegex)
  if (!match) return null
  return match[1]
}

const SYSTEM_PROMPT = `Ты подбираешь ОДИН эмодзи по описанию на русском или английском языке.

Правила:
- Ответ должен быть РОВНО ОДИН эмодзи, БЕЗ текста
- Эмодзи должно быть самым близким по смыслу к описанию
- Если описание про деньги, финансы, категорию трат — подбирай релевантный эмодзи
- Примеры:
  "коктейли на пляже" → 🍹
  "продукты в магазине" → 🛒
  "отпуск в абхазию" → 🏖️
  "новый макбук" → 💻
  "курсы программирования" → 💻
  "подарки на др" → 🎁
  "автомобиль" → 🚗
  "подписка нетфликс" → 🎬

Описание: `

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return corsPreflight()
  if (req.method !== 'POST') {
    return json({ error: 'Only POST allowed' }, 405)
  }

  // Извлекаем user.id
  const initData = req.headers.get('x-telegram-init-data') || ''
  const userId = extractUserId(initData)

  // Rate limit
  const rl = checkRateLimit(userId)
  if (!rl.ok) {
    return json({ error: rl.reason }, 429)
  }

  // Парсим тело
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Невалидный JSON' }, 400)
  }

  const description = String(body?.description ?? '').trim()
  if (!description) {
    return json({ error: 'Опиши иконку словами' }, 400)
  }
  if (description.length > 100) {
    return json({ error: 'Описание слишком длинное (макс 100 символов)' }, 400)
  }

  // Серверная модерация — защита от обхода клиентской проверки
  const modResult = moderateInput(description)
  if (!modResult.ok) {
    return json({
      error: 'Такой запрос запрещён правилами приложения',
      blocked: true,
    }, 403)
  }

  // Вызываем Gemini
  try {
    const prompt = SYSTEM_PROMPT + description
    const response = await callGemini({ prompt, maxTokens: 20, temperature: 0.4 })

    const emoji = extractFirstEmoji(response)
    if (!emoji) {
      // Gemini вернул что-то без эмодзи — возвращаем дефолт
      return json({ emoji: '📌', fallback: true })
    }

    return json({ emoji })
  } catch (e) {
    const msg = (e as Error).message
    console.error('AI emoji error:', msg)
    return json({ error: 'ИИ временно недоступен, попробуй ещё раз' }, 502)
  }
}
