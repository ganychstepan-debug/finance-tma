/**
 * Клиентские вызовы к /api/ai/* эндпоинтам.
 *
 * Все запросы отправляют Telegram initData в заголовке x-telegram-init-data,
 * чтобы сервер мог привязать rate limit к конкретному юзеру.
 */

const getInitData = (): string => {
  try {
    return (window as any).Telegram?.WebApp?.initData || ''
  } catch {
    return ''
  }
}

// ============================================================================
// Подбор эмодзи по описанию
// ============================================================================

export interface EmojiResult {
  emoji: string
  fallback?: boolean   // true если Gemini не смог и вернулся дефолт
}

export const suggestEmoji = async (description: string): Promise<EmojiResult> => {
  const res = await fetch('/api/emoji', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
    },
    body: JSON.stringify({ description }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data.blocked) {
      throw new Error('запрещённое содержимое')
    }
    throw new Error(data.error || `Ошибка ${res.status}`)
  }

  const data = await res.json()
  return {
    emoji: data.emoji,
    fallback: Boolean(data.fallback),
  }
}

// ============================================================================
// Скан чека — Gemini Vision
// ============================================================================

export interface ReceiptItem {
  name: string
  price: number
  categoryName: string
}
export interface ReceiptCategoryGroup {
  categoryName: string
  categoryId?: string
  total: number
}
export interface ReceiptScanResult {
  amount: number
  subtotal?: number
  discount?: number
  merchant: string
  date: string       // YYYY-MM-DD
  categoryId?: string
  categoryName: string
  items: ReceiptItem[]
  byCategory: ReceiptCategoryGroup[]
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Конвертирует File в base64 без data-URL префикса.
 * Дополнительно сжимает изображение чтобы не слать огромный файл.
 */
export const fileToBase64 = (file: File, maxSize = 1600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        // Сжимаем если нужно
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas не поддерживается')); return }
        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82)
        // Убираем "data:image/jpeg;base64," префикс
        const base64 = compressed.split(',')[1]
        resolve(base64)
      }
      img.onerror = () => reject(new Error('Не удалось прочитать фото'))
      img.src = dataUrl
    }
    reader.onerror = () => reject(new Error('Ошибка чтения файла'))
    reader.readAsDataURL(file)
  })
}

export const scanReceipt = async (
  file: File,
  categories: { id: string; name: string }[]
): Promise<ReceiptScanResult> => {
  const imageBase64 = await fileToBase64(file)

  const res = await fetch('/api/receipt-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
    },
    body: JSON.stringify({ imageBase64, categories }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data.blocked) throw new Error('запрещённое содержимое')
    if (data.fallback) throw new Error(data.error || 'Не удалось распознать чек')
    throw new Error(data.error || `Ошибка сервера ${res.status}`)
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('Сервер вернул некорректный ответ')
  }
  return {
    amount: Number(data.amount) || 0,
    subtotal: data.subtotal ? Number(data.subtotal) : undefined,
    discount: data.discount ? Number(data.discount) : undefined,
    merchant: String(data.merchant || ''),
    date: String(data.date || new Date().toISOString().slice(0, 10)),
    categoryId: data.categoryId,
    categoryName: String(data.categoryName || ''),
    items: Array.isArray(data.items) ? data.items : [],
    byCategory: Array.isArray(data.byCategory) ? data.byCategory : [],
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
  }
}
