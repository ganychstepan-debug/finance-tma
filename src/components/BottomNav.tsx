import { haptic } from '@/lib/telegram'

export type Tab = 'home' | 'categories' | 'stats' | 'debts'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  onAddTap: () => void
}

interface IconProps { active: boolean }

const IconHome: React.FC<IconProps> = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
)

const IconCategories: React.FC<IconProps> = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="14" y="3" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="3" y="14" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
)

const IconStats: React.FC<IconProps> = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" rx="0.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
    <rect x="12" y="8" width="3" height="10" rx="0.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
    <rect x="17" y="5" width="3" height="13" rx="0.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0} />
  </svg>
)

const IconDebts: React.FC<IconProps> = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 9v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <path d="M22 12h-6a2 2 0 0 0 0 4h6v-4Z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <circle cx="17" cy="14" r="0.8" fill="currentColor" />
  </svg>
)

const tabs: { id: Tab; label: string; Icon: React.FC<IconProps> }[] = [
  { id: 'home',       label: 'Главная',    Icon: IconHome },
  { id: 'categories', label: 'Категории',  Icon: IconCategories },
  { id: 'stats',      label: 'Статистика', Icon: IconStats },
  { id: 'debts',      label: 'Долги',      Icon: IconDebts },
]

const TabButton: React.FC<{
  tab: typeof tabs[number]
  active: boolean
  onClick: () => void
}> = ({ tab, active, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer py-1.5 px-1 flex-1 transition-transform active:scale-95 relative"
    style={{ color: active ? 'rgb(var(--c-accent))' : 'rgb(var(--c-text-muted))' }}
  >
    <tab.Icon active={active} />
    <span className="text-[11px] font-medium transition-colors" style={{ letterSpacing: '0.01em' }}>
      {tab.label}
    </span>
    {active && (
      <div
        className="absolute bottom-0 w-6 h-[2px] rounded-t-sm"
        style={{ backgroundColor: 'rgb(var(--c-accent))', boxShadow: '0 0 8px rgb(var(--c-accent))' }}
      />
    )}
  </button>
)

export const BottomNav: React.FC<Props> = ({ active, onChange, onAddTap }) => {
  const go = (id: Tab) => {
    if (id === active) return
    haptic.light()
    onChange(id)
  }

  const [home, categories, stats, debts] = tabs

  return (
    <nav
      className="relative border-t border-border-muted bg-bg-nav flex items-center z-20"
      style={{
        paddingTop: 8,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <TabButton tab={home}       active={active === 'home'}       onClick={() => go('home')} />
      <TabButton tab={categories} active={active === 'categories'} onClick={() => go('categories')} />

      {/* Центральная кнопка "+" — FAB с двухслойной анимацией */}
      <div className="flex-1 flex justify-center">
        <div className="fab-outer relative">
          <button
            onClick={() => { haptic.medium(); onAddTap() }}
            className="fab-inner w-16 h-16 rounded-full bg-accent border-0 cursor-pointer flex items-center justify-center text-white"
            aria-label="Добавить"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <TabButton tab={stats} active={active === 'stats'} onClick={() => go('stats')} />
      <TabButton tab={debts} active={active === 'debts'} onClick={() => go('debts')} />
    </nav>
  )
}
