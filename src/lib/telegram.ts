// Обёртка над Telegram WebApp SDK.
// Если приложение открыто вне Telegram (локальная разработка) — заглушки.

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string            // URL аватарки юзера (если доступна)
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string    // параметр из ссылки ?startapp=...
  }
  version: string
  ready: () => void
  expand: () => void
  close: () => void
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    setText: (text: string) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: Error | null, ok: boolean) => void) => void
    getItem: (key: string, cb: (err: Error | null, value: string) => void) => void
    getItems: (keys: string[], cb: (err: Error | null, values: Record<string, string>) => void) => void
    removeItem: (key: string, cb?: (err: Error | null, ok: boolean) => void) => void
    getKeys: (cb: (err: Error | null, keys: string[]) => void) => void
  }
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  // Bot API 6.9+ — запрос разрешения писать юзеру
  requestWriteAccess?: (cb?: (ok: boolean) => void) => void
  // Bot API 6.9+ — запрос номера телефона
  requestContact?: (cb?: (ok: boolean) => void) => void
  // Bot API 6.2+ — нативный popup
  showPopup?: (
    params: {
      title?: string
      message: string
      buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }>
    },
    cb?: (buttonId: string) => void,
  ) => void
  isVersionAtLeast?: (version: string) => boolean
  // Bot API 6.1+ — открыть внешнюю ссылку в браузере
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  // Bot API 6.1+ — открыть ссылку Telegram (канал, чат, бот)
  openTelegramLink?: (url: string) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

const tg = (): TelegramWebApp | null => {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export const isTelegram = (): boolean => Boolean(tg())

export const initTelegram = (): void => {
  const webApp = tg()
  if (!webApp) {
    console.warn('[Telegram] Running outside Telegram — using stubs')
    return
  }
  webApp.ready()
  webApp.expand()
  try {
    webApp.setHeaderColor('#0a0a0a')
    webApp.setBackgroundColor('#0a0a0a')
  } catch {}
}

export const getUser = (): TelegramUser | null => {
  return tg()?.initDataUnsafe?.user ?? null
}

export const getInitData = (): string => {
  return tg()?.initData ?? ''
}

export const haptic = {
  light: () => tg()?.HapticFeedback.impactOccurred('light'),
  medium: () => tg()?.HapticFeedback.impactOccurred('medium'),
  success: () => tg()?.HapticFeedback.notificationOccurred('success'),
  warning: () => tg()?.HapticFeedback.notificationOccurred('warning'),
  error: () => tg()?.HapticFeedback.notificationOccurred('error'),
  select: () => tg()?.HapticFeedback.selectionChanged(),
}

// CloudStorage обёрнут в промисы
export const cloud = {
  async set(key: string, value: string): Promise<void> {
    const webApp = tg()
    if (!webApp) return
    return new Promise((resolve, reject) => {
      webApp.CloudStorage.setItem(key, value, (err, ok) => {
        if (err || !ok) reject(err ?? new Error('CloudStorage set failed'))
        else resolve()
      })
    })
  },
  async get(key: string): Promise<string | null> {
    const webApp = tg()
    if (!webApp) return null
    return new Promise((resolve, reject) => {
      webApp.CloudStorage.getItem(key, (err, value) => {
        if (err) reject(err)
        else resolve(value || null)
      })
    })
  },
  async getMany(keys: string[]): Promise<Record<string, string>> {
    const webApp = tg()
    if (!webApp) return {}
    return new Promise((resolve, reject) => {
      webApp.CloudStorage.getItems(keys, (err, values) => {
        if (err) reject(err)
        else resolve(values || {})
      })
    })
  },
  async remove(key: string): Promise<void> {
    const webApp = tg()
    if (!webApp) return
    return new Promise((resolve, reject) => {
      webApp.CloudStorage.removeItem(key, (err, ok) => {
        if (err || !ok) reject(err ?? new Error('CloudStorage remove failed'))
        else resolve()
      })
    })
  },
  async keys(): Promise<string[]> {
    const webApp = tg()
    if (!webApp) return []
    return new Promise((resolve, reject) => {
      webApp.CloudStorage.getKeys((err, keys) => {
        if (err) reject(err)
        else resolve(keys || [])
      })
    })
  },
}

// ============================================================================
// Telegram BackButton — нативная кнопка «Назад» в шапке Telegram
// ============================================================================

/**
 * Показывает нативную кнопку «Назад» (стрелка влево) в шапке Telegram WebApp
 * и регистрирует обработчик.
 * Возвращает функцию cleanup для отписки и скрытия кнопки.
 *
 * Используется в эффектах:
 *   useEffect(() => showBackButton(onClose), [onClose])
 */
export const showBackButton = (handler: () => void): (() => void) => {
  const webApp = tg()
  if (!webApp?.BackButton) return () => {}

  try {
    webApp.BackButton.onClick(handler)
    webApp.BackButton.show()
  } catch (e) {
    console.warn('showBackButton failed', e)
  }

  return () => {
    try {
      webApp.BackButton.offClick(handler)
      webApp.BackButton.hide()
    } catch {}
  }
}

// ============================================================================
// Разрешение на уведомления от бота + номер телефона
// ============================================================================

/**
 * Запрашивает у пользователя разрешение боту писать в личные сообщения.
 * Юзер увидит системный диалог Telegram «Разрешить боту писать?».
 *
 * Работает на Bot API 6.9+. На старых версиях — no-op (сразу резолвится false).
 *
 * Возвращает true если пользователь дал согласие или если это уже делал ранее.
 */
export const requestWriteAccess = (): Promise<boolean> => {
  const webApp = tg()
  if (!webApp?.requestWriteAccess) {
    console.warn('requestWriteAccess: API недоступен (старая версия Telegram)')
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    try {
      webApp.requestWriteAccess!((ok: boolean) => resolve(Boolean(ok)))
    } catch (e) {
      console.warn('requestWriteAccess failed', e)
      resolve(false)
    }
  })
}

/**
 * Запрашивает номер телефона через нативный диалог Telegram.
 * Возвращает true если юзер поделился.
 */
export const requestContact = (): Promise<boolean> => {
  const webApp = tg()
  if (!webApp?.requestContact) {
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    try {
      webApp.requestContact!((ok: boolean) => resolve(Boolean(ok)))
    } catch (e) {
      console.warn('requestContact failed', e)
      resolve(false)
    }
  })
}

/**
 * Нативный попап Telegram — красивее чем window.alert/confirm.
 * Возвращает id нажатой кнопки.
 *
 * Пример:
 *   await showPopup({
 *     title: 'Удалить?',
 *     message: 'Это действие нельзя отменить.',
 *     buttons: [
 *       { id: 'yes', type: 'destructive', text: 'Удалить' },
 *       { id: 'no', type: 'cancel' }
 *     ]
 *   })
 */
export const showPopup = (params: {
  title?: string
  message: string
  buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }>
}): Promise<string> => {
  const webApp = tg()
  if (!webApp?.showPopup) {
    // Fallback на браузерный confirm
    const ok = window.confirm((params.title ? params.title + '\n\n' : '') + params.message)
    return Promise.resolve(ok ? 'ok' : 'cancel')
  }
  return new Promise((resolve) => {
    try {
      webApp.showPopup!(params, (id: string) => resolve(id || 'close'))
    } catch (e) {
      console.warn('showPopup failed', e)
      resolve('close')
    }
  })
}

// ============================================================================
// Открытие ссылок
// ============================================================================

/**
 * Открывает внешнюю ссылку в браузере (по умолчанию). Через Telegram WebApp если доступно.
 */
export const openLink = (url: string): void => {
  const webApp = tg()
  if (webApp?.openLink) {
    try {
      webApp.openLink(url)
      return
    } catch {}
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Открывает ссылку на канал/чат/бот в Telegram (поверх Mini App).
 * После возврата Mini App остаётся открытым.
 */
export const openTelegramLink = (url: string): void => {
  const webApp = tg()
  if (webApp?.openTelegramLink) {
    try {
      webApp.openTelegramLink(url)
      return
    } catch {}
  }
  // Fallback — обычная ссылка
  openLink(url)
}

/**
 * Открывает нативный диалог «Поделиться в Telegram».
 * Юзер выбирает чат/канал, куда отправить сообщение с ссылкой и текстом.
 *
 * Использует официальный механизм Telegram — https://t.me/share/url
 */
export const shareViaTelegram = (url: string, text: string): void => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  openTelegramLink(shareUrl)
}
