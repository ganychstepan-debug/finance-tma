// Каталог иконок. В беты используем эмодзи для скорости.
// В v1.1 заменим на SVG-сет (Lucide + кастомные банки).

export interface IconDef {
  id: string
  emoji: string
  label: string
}

export const CATEGORY_ICONS: IconDef[] = [
  { id: 'food',       emoji: '🍔', label: 'Еда' },
  { id: 'transport',  emoji: '🚗', label: 'Транспорт' },
  { id: 'home',       emoji: '🏠', label: 'Дом' },
  { id: 'fun',        emoji: '🎮', label: 'Развлечения' },
  { id: 'clothes',    emoji: '👕', label: 'Одежда' },
  { id: 'health',     emoji: '💊', label: 'Здоровье' },
  { id: 'travel',     emoji: '✈️', label: 'Поездки' },
  { id: 'phone',      emoji: '📱', label: 'Связь' },
  { id: 'gift',       emoji: '🎁', label: 'Подарки' },
  { id: 'book',       emoji: '📚', label: 'Образование' },
  { id: 'sport',      emoji: '💪', label: 'Спорт' },
  { id: 'beauty',     emoji: '💄', label: 'Красота' },
  { id: 'subscription', emoji: '🔄', label: 'Подписки' },
  { id: 'kids',       emoji: '👶', label: 'Дети' },
  { id: 'pets',       emoji: '🐾', label: 'Питомцы' },
  { id: 'cafe',       emoji: '☕', label: 'Кафе' },
  { id: 'movie',      emoji: '🎬', label: 'Кино' },
  { id: 'cart',       emoji: '🛒', label: 'Продукты' },
  { id: 'utility',    emoji: '💡', label: 'Коммуналка' },
  { id: 'salary',     emoji: '💼', label: 'Зарплата' },
  { id: 'freelance',  emoji: '💻', label: 'Фриланс' },
  { id: 'invest',     emoji: '📈', label: 'Инвестиции' },
  { id: 'cashback',   emoji: '💸', label: 'Кэшбэк' },
  { id: 'wallet',     emoji: '👛', label: 'Кошелёк' },
  { id: 'money',      emoji: '💵', label: 'Наличные' },
  { id: 'card',       emoji: '💳', label: 'Карта' },
  { id: 'deposit',    emoji: '🏦', label: 'Вклад' },
  { id: 'other',      emoji: '⭐', label: 'Прочее' },
]

export const iconById = (id: string): IconDef =>
  CATEGORY_ICONS.find((i) => i.id === id) ?? CATEGORY_ICONS[CATEGORY_ICONS.length - 1]

// Банки: буквенные логотипы с брендовым цветом
export interface BankDef {
  id: string
  name: string
  short: string // 1-2 буквы
  color: string // фон логотипа
}

export const BANKS: BankDef[] = [
  { id: 'tinkoff',    name: 'Тинькофф',    short: 'Т', color: '#FFDD2D' },
  { id: 'sber',       name: 'Сбер',        short: 'С', color: '#21A038' },
  { id: 'alfa',       name: 'Альфа-Банк',  short: 'А', color: '#EF3124' },
  { id: 'vtb',        name: 'ВТБ',         short: 'В', color: '#0A2973' },
  { id: 'gazprom',    name: 'Газпромбанк', short: 'Г', color: '#005FAA' },
  { id: 'raif',       name: 'Райффайзен',  short: 'Р', color: '#FEE600' },
  { id: 'otkritie',   name: 'Открытие',    short: 'О', color: '#00ADEF' },
  { id: 'post',       name: 'Почта Банк',  short: 'П', color: '#1B355E' },
  { id: 'yandex',     name: 'Яндекс Банк', short: 'Я', color: '#FC3F1D' },
  { id: 'ozon',       name: 'Озон Банк',   short: 'O', color: '#005BFF' },
  { id: 'none',       name: 'Без банка',   short: '★', color: '#666666' },
  { id: 'other',      name: 'Другой банк', short: '?', color: '#444444' },
]

export const bankById = (id?: string, customBanks?: BankDef[]): BankDef => {
  if (id?.startsWith('custom_') && customBanks) {
    const cb = customBanks.find((b) => b.id === id)
    if (cb) return cb
  }
  return BANKS.find((b) => b.id === id) ?? BANKS[BANKS.length - 1]
}
