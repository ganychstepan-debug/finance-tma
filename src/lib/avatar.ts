// Утилиты для аватарки пользователя.
// 1. Генерация красивого градиента на основе id/username (детерминированно).
// 2. Хранение собственной аватарки юзера (base64) в LocalStorage.

// ============================================================================
// Детерминированный цвет по строке
// ============================================================================

const hashString = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// Палитра «тёплых» градиентов в стиле приложения (красно-фиолетово-оранжевых)
const PALETTES: [string, string][] = [
  ['#ff0033', '#7a0020'],   // красный классический
  ['#ff3d7f', '#8a0038'],   // розово-малиновый
  ['#ff6b35', '#8a2a00'],   // оранжево-алый
  ['#ff0844', '#4a0020'],   // алый в тёмный
  ['#b91372', '#3a0528'],   // винный
  ['#e63946', '#5a1015'],   // коралл
  ['#cc2936', '#400c12'],   // рубиновый
  ['#c41e3a', '#2e0510'],   // тёмно-красный
]

export const gradientForUser = (seed: string | number): { from: string; to: string } => {
  const s = String(seed ?? 'guest')
  const idx = hashString(s) % PALETTES.length
  const [from, to] = PALETTES[idx]
  return { from, to }
}

// ============================================================================
// Кастомная аватарка (base64)
// ============================================================================

const CUSTOM_AVATAR_KEY = 'custom_avatar_dataurl'

export const getCustomAvatar = (): string | null => {
  try {
    return localStorage.getItem(CUSTOM_AVATAR_KEY)
  } catch {
    return null
  }
}

export const setCustomAvatar = (dataUrl: string): void => {
  try {
    localStorage.setItem(CUSTOM_AVATAR_KEY, dataUrl)
  } catch (e) {
    console.error('save custom avatar failed', e)
  }
}

export const removeCustomAvatar = (): void => {
  try {
    localStorage.removeItem(CUSTOM_AVATAR_KEY)
  } catch {}
}

/**
 * Ресайзит и сжимает изображение в квадратный data URL для аватарки.
 * Возвращает ~128×128 JPEG base64, около 10-20 КБ.
 */
export const processAvatarFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Не изображение'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Файл больше 5 МБ'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Не удалось декодировать изображение'))
      img.onload = () => {
        try {
          const size = 128
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('canvas context failed')

          // Выбираем квадратный кроп по центру
          const src = Math.min(img.width, img.height)
          const sx = (img.width - src) / 2
          const sy = (img.height - src) / 2

          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, size, size)
          ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size)

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          resolve(dataUrl)
        } catch (e) {
          reject(e)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
