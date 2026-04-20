# Finance TMA — Telegram Mini App для учёта финансов

Бета-версия. Красно-чёрный неон-минимализм, React + Vite + TypeScript.

## Что внутри

- 💳 Счета: карты (логотипы 10 банков РФ), наличные, вклады, кошельки
- 🗂️ Категории: 18 базовых + любые свои, с месячным бюджетом
- 💸 Транзакции: расходы, доходы, быстрый ввод через цифровую клавиатуру
- 📊 Статистика: круговая диаграмма, топ-5 категорий, сравнение с прошлым месяцем
- 🤝 Долги: учёт «я должен» и «мне должны»
- 🌍 6 валют: ₽ $ € ₸ Br ₴
- ☁️ Синк между устройствами через Telegram CloudStorage
- 📳 Хаптика: вибро-отклик на действия

## Запуск локально

```bash
npm install
npm run dev
```

Откроется на http://localhost:5173. Приложение работает и вне Telegram — данные в LocalStorage. При открытии в Telegram дополнительно подключается CloudStorage.

## Сборка под продакшн

```bash
npm run build
```

Готовая статика — в `dist/`. Её можно задеплоить куда угодно.

## Деплой

### Cloudflare Pages (рекомендую, бесплатно)
1. Запушь код в GitHub
2. dash.cloudflare.com → Pages → Create → Connect to Git
3. Framework preset: Vite · Build: `npm run build` · Output: `dist`
4. Получишь URL `https://finance-tma.pages.dev`

### Vercel
```bash
vercel --prod
```

### Netlify
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## Подключение к Telegram

1. @BotFather → `/newbot`, получи токен
2. `/newapp` → выбери бота → название → описание → фото 640×360 → URL задеплоенного приложения
3. Отправь ссылку `https://t.me/<bot_username>/<app_short_name>` или прикрепи через `/mybots` → Bot Settings → Menu Button

В Telegram Desktop можно дебажить: Settings → Advanced → Experimental → Enable webview inspecting.

## Архитектура

```
src/
├── types/            Все TypeScript-типы
├── lib/
│   ├── telegram.ts   Обёртка над WebApp SDK + заглушки
│   ├── storage.ts    LocalStorage (L1) + CloudStorage (L2)
│   ├── icons.ts      28 иконок + 11 банков РФ
│   └── formatters.ts Деньги, даты
├── store/            Zustand, CRUD + автопересчёт балансов
├── components/       AccountCard · TransactionRow · CategoryIcon · NumPad · BottomNav · HomeHeader
├── screens/          7 экранов: Home · Accounts · AccountEdit · Categories · CategoryEdit · Stats · Debts · AddTransaction
├── App.tsx           Роутер (табы + модалки)
├── main.tsx          Точка входа, инициализация Telegram
└── index.css         Tailwind + глобальные стили
```

## Хранение

**L1: LocalStorage** — ключ `finance_app_state`, синхронное чтение при старте.

**L2: Telegram CloudStorage** — синк между устройствами:
- `accounts`, `categories`, `debts`, `settings`, `meta` — по одному ключу
- `tx_YYYY_MM` — транзакции шардируются по месяцам (лимит CloudStorage: 4KB/ключ, 1024 ключа)

**L3: Бэкенд** — запланирован на v1.1.

## Roadmap

### Sprint 4
- [ ] Debounced автосинк в CloudStorage
- [ ] Telegram-бот на grammY для уведомлений
- [ ] Напоминания, алерты о превышении бюджета
- [ ] Еженедельная сводка

### Sprint 5
- [ ] Курсы валют (ЦБ РФ API)
- [ ] Мультивалютный пересчёт общего баланса
- [ ] Переводы между счетами
- [ ] Экран всех транзакций с фильтрами
- [ ] Онбординг

### v1.1+
- Бэкенд + PostgreSQL
- SMS-парсинг (opt-in)
- Цели накопления
- Совместные бюджеты
- Экспорт в CSV/Excel

## Лицензия

MIT.
