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

// v0.94: подбор иконки категории по её названию (эвристика + ключевые слова)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food:         ['еда', 'продукт', 'food', 'grocer', 'супермаркет', 'магазин', 'пятёрочка', 'пятерочка', 'магнит', 'ашан', 'лента', 'дикси', 'перекресток', 'vkusvill', 'вкусвилл'],
  cart:         ['покупк', 'shopping', 'shop', 'маркет'],
  transport:    ['транспорт', 'transport', 'такси', 'taxi', 'метро', 'бензин', 'fuel', 'парковк', 'авто', 'машин'],
  home:         ['дом', 'home', 'house', 'ремонт', 'квартир', 'жкх', 'аренд', 'rent', 'мебель'],
  fun:          ['развлеч', 'fun', 'entertain', 'игр', 'game'],
  movie:        ['кино', 'movie', 'cinema', 'фильм'],
  cafe:         ['кофе', 'кафе', 'coffee', 'cafe', 'ресторан', 'restaurant', 'еда вне', 'starbuck', 'шоколадниц', 'кофейн'],
  clothes:      ['одежд', 'clothes', 'обувь', 'shoe', 'apparel'],
  health:       ['здоров', 'health', 'аптек', 'pharmac', 'medic', 'врач', 'doctor'],
  travel:       ['путеш', 'travel', 'поездк', 'trip', 'отпуск', 'отель', 'hotel', 'авиа', 'flight'],
  phone:        ['связь', 'phone', 'mobile', 'интернет', 'internet', 'мтс', 'билайн', 'мегафон', 'tele2', 'tele 2'],
  gift:         ['подар', 'gift'],
  book:         ['образов', 'книг', 'book', 'education', 'учёб', 'учеб', 'курс', 'course'],
  sport:        ['спорт', 'sport', 'фитнес', 'fitness', 'gym', 'зал'],
  beauty:       ['красот', 'beauty', 'салон', 'косметик', 'парикмах'],
  subscription: ['подписк', 'subscription', 'netflix', 'spotify', 'youtube premium', 'apple one', 'icloud'],
  kids:         ['дет', 'kids', 'child', 'малыш', 'ребен', 'ребён'],
  pets:         ['питом', 'pet', 'животн', 'корм'],
  utility:      ['коммунал', 'utility', 'свет', 'газ', 'воды', 'electric'],
  salary:       ['зарплат', 'salary', 'wage', 'оклад', 'аванс', 'премия', 'bonus'],
  freelance:    ['фриланс', 'freelance', 'подраб', 'самозан'],
  invest:       ['инвест', 'invest', 'дивид', 'divid', 'акци'],
  cashback:     ['кешбэк', 'кэшбэк', 'cashback', 'cash back', 'возврат'],
}

export const iconByName = (name: string): string => {
  if (!name) return 'other'
  const low = name.toLowerCase().trim()
  for (const [iconId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => low.includes(k))) return iconId
  }
  return 'other'
}

// v0.94: подбор bankId по названию счёта (корень слова)
const BANK_KEYWORDS: Record<string, string[]> = {
  tinkoff:  ['тинь', 'тинк', 'tinkoff', 'tcs', 'т-банк', 'tbank', 'black premium', 'блэк премиум'],
  sber:     ['сбер', 'sber', 'sberbank', 'cбер'],
  alfa:     ['альфа', 'alfa', 'альф'],
  vtb:      ['втб', 'vtb'],
  gazprom:  ['газпром', 'gazprom', 'газпромбанк'],
  raif:     ['райф', 'raif', 'raiff'],
  otkritie: ['открыт', 'otkri'],
  post:     ['почта банк', 'post bank', 'почтабанк'],
  yandex:   ['яндекс', 'yandex'],
  ozon:     ['озон', 'ozon'],
}

export const bankIdByName = (name: string): string | undefined => {
  if (!name) return undefined
  const low = name.toLowerCase().trim()
  for (const [bankId, keywords] of Object.entries(BANK_KEYWORDS)) {
    if (keywords.some((k) => low.includes(k))) return bankId
  }
  return undefined
}

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

// v0.94: Подобрать банк по имени счёта (для импорта)
// Ищет подстроки в названии: "Тинькофф Black" → tinkoff, "Альфабанк Голубева" → alfa
export const matchBankByName = (accountName: string): string => {
  const n = accountName.toLowerCase()
  const patterns: Array<[string, string[]]> = [
    ['tinkoff',  ['тинь', 'тинк', 'tinkoff', 'tink', 'т-банк', 't-bank', 'black premium', 'tbank']],
    ['sber',     ['сбер', 'sber']],
    ['alfa',     ['альфа', 'alfa', 'alpha']],
    ['vtb',      ['втб', 'vtb']],
    ['gazprom',  ['газпром', 'gazprom']],
    ['raif',     ['райф', 'raif', 'raiff']],
    ['otkritie', ['открытие', 'otkritie']],
    ['post',     ['почта банк', 'почтабанк', 'post bank']],
    ['yandex',   ['яндекс', 'yandex']],
    ['ozon',     ['озон', 'ozon']],
  ]
  for (const [id, keywords] of patterns) {
    if (keywords.some((kw) => n.includes(kw))) return id
  }
  return 'other'
}

// v0.94: Подобрать иконку категории по её названию
export const matchCategoryIcon = (categoryName: string): string => {
  const n = categoryName.toLowerCase()
  const patterns: Array<[string, string[]]> = [
    ['cart',         ['продукт', 'еда', 'супермарк', 'grocery', 'food', 'магазин', 'пятёрочк', 'пятерочк', 'магнит']],
    ['cafe',         ['кофе', 'cafe', 'café', 'кофейн', 'starbucks']],
    ['food',         ['ресторан', 'restaurant', 'обед', 'ужин', 'завтрак', 'еда вне', 'lunch', 'dinner']],
    ['transport',    ['транспорт', 'transport', 'такси', 'taxi', 'метро', 'бензин', 'fuel', 'машин', 'авто', 'car', 'парковк', 'проезд']],
    ['home',         ['дом', 'home', 'квартир', 'жкх', 'коммунал']],
    ['utility',      ['свет', 'газ', 'вода', 'интернет', 'internet', 'electricity', 'коммуналк']],
    ['fun',          ['развлеч', 'fun', 'игры', 'games', 'бар', 'bar', 'клуб']],
    ['movie',        ['кино', 'movie', 'cinema', 'film', 'театр', 'theatre']],
    ['clothes',      ['одежд', 'cloth', 'одежда', 'обувь', 'shoes', 'fashion']],
    ['health',       ['здоров', 'health', 'медиц', 'доктор', 'врач', 'аптек', 'medicine', 'pharmacy', 'стомат']],
    ['beauty',       ['красот', 'beauty', 'косметик', 'cosmetic', 'парикмахер', 'маникюр', 'spa', 'салон']],
    ['sport',        ['спорт', 'sport', 'fitness', 'фитнес', 'зал', 'gym']],
    ['travel',       ['путешеств', 'travel', 'trip', 'отпуск', 'vacation', 'поездк', 'самолёт', 'авиа', 'отель', 'hotel', 'airbnb']],
    ['phone',        ['связь', 'phone', 'телефон', 'мобильн', 'mobile', 'сотов']],
    ['subscription', ['подписк', 'subscription', 'netflix', 'spotify', 'youtube', 'premium', 'apple music']],
    ['gift',         ['подар', 'gift']],
    ['book',         ['образован', 'education', 'курс', 'course', 'книг', 'book', 'учеб']],
    ['kids',         ['дет', 'kids', 'ребёнк', 'ребенк', 'игрушк', 'toys']],
    ['pets',         ['питом', 'pet', 'собак', 'кот', 'dog', 'cat', 'корм']],
    ['salary',       ['зарплат', 'salary', 'аванс', 'оклад', 'premium']],
    ['freelance',    ['фриланс', 'freelance', 'подработк']],
    ['invest',       ['инвест', 'invest', 'акц', 'stock', 'дивид', 'dividend']],
    ['cashback',     ['кэшбэк', 'cashback', 'cash back', 'возврат']],
    ['gift',         ['подарок', 'награда', 'bonus', 'бонус']],
  ]
  for (const [id, keywords] of patterns) {
    if (keywords.some((kw) => n.includes(kw))) return id
  }
  return 'other'
}
