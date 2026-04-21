import { useState } from 'react'
import { useStore, selectCategorySpend } from '@/store'
import { CategoryIcon } from '@/components/CategoryIcon'
import { formatMoney } from '@/lib/formatters'
import { haptic } from '@/lib/telegram'
import type { CategoryType, Category } from '@/types'

interface Props {
  onAddNew: (type: CategoryType) => void
  onEdit: (id: string) => void
}

type ViewMode = 'list' | 'grid'
const VIEW_MODE_KEY = 'categories_view_mode'

export const CategoriesScreen: React.FC<Props> = ({ onAddNew, onEdit }) => {
  const state = useStore()
  const [tab, setTab] = useState<CategoryType>('expense')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'grid'
    } catch {
      return 'grid'
    }
  })

  const setView = (mode: ViewMode) => {
    haptic.select()
    setViewMode(mode)
    try { localStorage.setItem(VIEW_MODE_KEY, mode) } catch {}
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  const categories = state.categories
    .filter((c) => c.type === tab && !c.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const budgetedCategories = categories.filter((c) => (c.budgetMonthly ?? 0) > 0)
  const totalBudget = budgetedCategories.reduce((sum, c) => sum + (c.budgetMonthly ?? 0), 0)
  const spentInBudgeted = budgetedCategories.reduce(
    (sum, c) => sum + selectCategorySpend(state, c.id, y, m),
    0,
  )
  const totalSpent = categories.reduce(
    (sum, c) => sum + selectCategorySpend(state, c.id, y, m),
    0,
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-4">
      <div className="px-5 pt-3 pb-4 flex justify-between items-center">
        <div className="text-xl font-medium">Категории</div>
        <button
          onClick={() => { haptic.light(); onAddNew(tab) }}
          className="text-xs text-accent bg-transparent border-0 cursor-pointer"
        >
          + Новая
        </button>
      </div>

      {/* Таб-переключатель */}
      <div className="px-5 mb-3 flex gap-1.5">
        <button
          onClick={() => { haptic.select(); setTab('expense') }}
          className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
            tab === 'expense' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
          }`}
        >
          Расходы
        </button>
        <button
          onClick={() => { haptic.select(); setTab('income') }}
          className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
            tab === 'income' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
          }`}
        >
          Доходы
        </button>
      </div>

      {/* Переключатель вида — с пружинистым слайдером */}
      <div className="px-5 mb-4 flex justify-end">
        <div className="relative inline-flex p-[3px] bg-bg-secondary border border-border rounded-btn" style={{ borderWidth: '0.5px' }}>
          <div
            className="absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] bg-bg-tertiary rounded-[9px] transition-all duration-300 spring-ease"
            style={{
              left: viewMode === 'grid' ? '3px' : 'calc(50%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          />
          <button
            onClick={() => setView('grid')}
            className={`relative px-3 py-1.5 text-[11px] font-medium cursor-pointer border-0 bg-transparent flex items-center gap-1.5 z-10 ${
              viewMode === 'grid' ? 'text-white' : 'text-text-muted'
            }`}
            aria-label="Вид сеткой"
          >
            <GridIcon active={viewMode === 'grid'} />
            <span>Сетка</span>
          </button>
          <button
            onClick={() => setView('list')}
            className={`relative px-3 py-1.5 text-[11px] font-medium cursor-pointer border-0 bg-transparent flex items-center gap-1.5 z-10 ${
              viewMode === 'list' ? 'text-white' : 'text-text-muted'
            }`}
            aria-label="Вид списком"
          >
            <ListIcon active={viewMode === 'list'} />
            <span>Список</span>
          </button>
        </div>
      </div>

      {/* Сводка месяца */}
      {tab === 'expense' && totalSpent > 0 && (
        <div className="px-5 mb-4">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">
            Израсходовано в этом месяце
          </div>
          <div className="text-2xl font-light">
            {Math.round(totalSpent).toLocaleString('ru-RU')} <span className="text-text-muted">₽</span>
          </div>
          {totalBudget > 0 && (
            <div className="text-xs text-text-muted mt-1">
              По категориям с бюджетом: {Math.round(spentInBudgeted).toLocaleString('ru-RU')} из {Math.round(totalBudget).toLocaleString('ru-RU')} ₽
            </div>
          )}
        </div>
      )}

      {/* Рендер категорий — в зависимости от вида */}
      {categories.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3">📂</div>
          <div className="text-sm text-text-secondary">
            Нет категорий {tab === 'expense' ? 'расходов' : 'доходов'}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <>
        <div className="px-5 grid grid-cols-4 gap-1.5">
          {categories.map((c) => (
            <CategoryGridItem
              key={c.id}
              category={c}
              spent={selectCategorySpend(state, c.id, y, m)}
              onClick={() => onEdit(c.id)}
            />
          ))}
          <button
            onClick={() => { haptic.light(); onAddNew(tab) }}
            className="aspect-square bg-transparent border border-dashed border-border rounded-btn flex flex-col items-center justify-center gap-0.5 text-accent cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-xl font-light leading-none">+</span>
            <span className="text-[8px]">Создать</span>
          </button>
        </div>

        {/* v0.80: 5.17 Плашка предупреждения перерасхода */}
        <OverbudgetWarning categories={categories} state={state} y={y} m={m} />
        </>
      ) : (
        <div className="px-5 space-y-2.5">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              spent={selectCategorySpend(state, c.id, y, m)}
              onClick={() => onEdit(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Иконки переключателя
const GridIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill={active ? '#fff' : '#888'}>
    <rect x="0" y="0" width="4" height="4" rx="0.5" />
    <rect x="6" y="0" width="4" height="4" rx="0.5" />
    <rect x="0" y="6" width="4" height="4" rx="0.5" />
    <rect x="6" y="6" width="4" height="4" rx="0.5" />
  </svg>
)

const ListIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="12" height="10" viewBox="0 0 12 10" stroke={active ? '#fff' : '#888'} strokeWidth="1.5" strokeLinecap="round">
    <line x1="0" y1="1" x2="12" y2="1" />
    <line x1="0" y1="5" x2="12" y2="5" />
    <line x1="0" y1="9" x2="12" y2="9" />
  </svg>
)

// Вид квадратиком — как на экране добавления
const CategoryGridItem: React.FC<{
  category: Category
  spent: number
  onClick: () => void
}> = ({ category, spent, onClick }) => {
  const hasBudget = category.budgetMonthly != null && category.budgetMonthly > 0
  const budget = category.budgetMonthly ?? 0
  const rawPercent = hasBudget ? (spent / budget) * 100 : 0
  const percent = hasBudget ? Math.min(Math.round(rawPercent), 999) : 0
  const isOver = rawPercent > 100
  // Высота заливки: 0-100% преобразуется в 0-100% высоты кубика
  const fillHeight = Math.min(100, Math.max(0, rawPercent))

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-btn flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
      style={{
        background: '#141414',
        border: isOver ? '2px solid #ff1744' : '0',
        boxShadow: isOver
          ? '0 0 20px rgba(255,23,68,0.6), 0 0 40px rgba(255,23,68,0.25), inset 0 0 18px rgba(255,23,68,0.35)'
          : undefined,
        animation: isOver ? 'overbudget-pulse 2s ease-in-out infinite' : undefined,
      }}
    >
      {/* Слой заливки — только если есть бюджет */}
      {hasBudget && fillHeight > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-500"
          style={{
            height: `${fillHeight}%`,
            background: isOver
              ? 'linear-gradient(to top, rgba(255,23,68,0.85), rgba(255,23,68,0.45))'
              : rawPercent > 70
              ? 'linear-gradient(to top, rgba(255,23,68,0.45), rgba(255,23,68,0.12))'
              : 'linear-gradient(to top, rgba(255,23,68,0.28), rgba(255,23,68,0.05))',
          }}
        />
      )}

      {/* v0.34: диагональные полосы при перерасходе */}
      {isOver && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255,23,68,0.2) 6px 12px)',
            opacity: 0.7,
          }}
        />
      )}

      {/* Контент поверх заливки */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-1">
        <CategoryIcon iconId={category.icon} size="sm" variant={category.type === 'income' ? 'income' : 'expense'} />
        <span className="text-[11px] font-medium text-white text-center px-1 leading-tight truncate max-w-full" style={{ textShadow: isOver ? '0 1px 2px rgba(0,0,0,0.5)' : undefined }}>
          {category.name}
        </span>
      </div>

      {hasBudget && (
        <span
          className={`absolute top-1 right-1.5 text-[9px] font-bold z-10 ${
            isOver
              ? 'text-white px-1 py-[1px] rounded'
              : rawPercent > 70 ? 'text-accent' : 'text-text-muted'
          }`}
          style={isOver ? {
            background: '#ff1744',
            boxShadow: '0 0 6px #ff1744',
          } : undefined}
        >
          {percent}%
        </span>
      )}
    </button>
  )
}

const CategoryRow: React.FC<{
  category: Category
  spent: number
  onClick: () => void
}> = ({ category, spent, onClick }) => {
  const hasBudget = category.budgetMonthly != null && category.budgetMonthly > 0
  const budget = category.budgetMonthly ?? 0
  const rawPercent = hasBudget ? (spent / budget) * 100 : 0
  const percent = hasBudget ? Math.min(Math.round(rawPercent), 999) : 0
  const isOver = rawPercent > 100
  const isIncome = category.type === 'income'
  const fillWidth = Math.min(100, Math.max(0, rawPercent))

  return (
    <div
      onClick={onClick}
      className="relative p-3.5 rounded-card cursor-pointer overflow-hidden"
      style={{
        background: '#141414',
        border: isOver ? '2px solid #ff1744' : '0.5px solid #222',
        boxShadow: isOver
          ? '0 0 16px rgba(255,23,68,0.5), 0 0 32px rgba(255,23,68,0.2), inset 0 0 14px rgba(255,23,68,0.2)'
          : undefined,
        animation: isOver ? 'overbudget-pulse 2s ease-in-out infinite' : undefined,
      }}
    >
      {/* Заливка слева-направо по проценту бюджета */}
      {hasBudget && fillWidth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none transition-all duration-500"
          style={{
            width: `${fillWidth}%`,
            background: isOver
              ? 'linear-gradient(to right, rgba(255,23,68,0.35), rgba(255,23,68,0.15))'
              : rawPercent > 70
              ? 'linear-gradient(to right, rgba(255,23,68,0.25), rgba(255,23,68,0.08))'
              : 'linear-gradient(to right, rgba(255,23,68,0.15), rgba(255,23,68,0.03))',
          }}
        />
      )}

      {/* v0.34: диагональные полосы при перерасходе */}
      {isOver && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255,23,68,0.15) 6px 12px)',
            opacity: 0.5,
          }}
        />
      )}

      <div className="relative z-10 flex items-center">
        <div className="mr-3">
          <CategoryIcon iconId={category.icon} size="sm" variant={isIncome ? 'income' : 'expense'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <span className="truncate">{category.name}</span>
            {isOver && (
              <span className="text-accent text-[10px] shrink-0">⚠ перерасход</span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {hasBudget
              ? `${Math.round(spent).toLocaleString('ru-RU')} из ${Math.round(budget).toLocaleString('ru-RU')} ₽`
              : isIncome
              ? `${formatMoney(spent, 'RUB')}`
              : `${formatMoney(spent, 'RUB')} · без бюджета`}
          </div>
        </div>
        <div
          className={`text-xs font-bold shrink-0 ml-2 ${
            isOver
              ? 'text-white px-1.5 py-0.5 rounded'
              : rawPercent > 70 ? 'text-accent' : 'text-text-muted font-medium'
          }`}
          style={isOver ? {
            background: '#ff1744',
            boxShadow: '0 0 6px #ff1744',
            fontSize: 10,
          } : undefined}
        >
          {hasBudget ? `${percent}%` : spent > 0 ? '—' : ''}
        </div>
      </div>
    </div>
  )
}

// v0.80: 5.17 Плашка предупреждения о перерасходе
type StoreState = Parameters<typeof selectCategorySpend>[0]

const OverbudgetWarning: React.FC<{
  categories: Category[]
  state: StoreState
  y: number
  m: number
}> = ({ categories, state, y, m }) => {
  const overbudget = categories
    .filter((c) => {
      const b = c.budgetMonthly ?? 0
      if (b <= 0) return false
      const spent = selectCategorySpend(state, c.id, y, m)
      return spent > b
    })
    .map((c) => ({
      category: c,
      spent: selectCategorySpend(state, c.id, y, m),
      over: selectCategorySpend(state, c.id, y, m) - (c.budgetMonthly ?? 0),
    }))

  if (overbudget.length === 0) return null

  const totalOver = overbudget.reduce((s, x) => s + x.over, 0)
  const baseCurrency = state.settings.baseCurrency

  return (
    <div
      className="mx-5 mt-4 flex items-start"
      style={{
        padding: '12px 14px',
        background: 'rgba(255,23,68,0.06)',
        border: '0.5px solid rgba(255,23,68,0.25)',
        borderRadius: 12,
        gap: 10,
      }}
    >
      <span style={{ fontSize: 14, marginTop: 1 }}>⚠️</span>
      <div>
        <div style={{ color: '#ff1744', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
          {overbudget.length === 1
            ? `Перерасход по «${overbudget[0].category.name}»`
            : `Перерасход по ${overbudget.length} категориям`}
        </div>
        <div style={{ color: '#aaa', fontSize: 10, lineHeight: 1.4 }}>
          {overbudget.length === 1
            ? `На ${Math.round(overbudget[0].over).toLocaleString('ru-RU')} ${baseCurrency} больше заложенного`
            : `Суммарно ${Math.round(totalOver).toLocaleString('ru-RU')} ${baseCurrency} сверх бюджета`}
        </div>
      </div>
    </div>
  )
}
