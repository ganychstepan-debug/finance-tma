import { useState } from 'react'
import { useStore } from '@/store'
import { haptic } from '@/lib/telegram'
import { formatMoney } from '@/lib/formatters'
import { iconById } from '@/lib/icons'
import { BUILTIN_CURRENCIES } from '@/types'
import type { Goal, Currency } from '@/types'
import { BackButton } from '@/components/BackButton'
import { AiEmojiPicker } from '@/components/AiEmojiPicker'
import { moderate, getCategoryList } from '@/lib/moderation'

interface Props {
  onClose: () => void
}

export const GoalsScreen: React.FC<Props> = ({ onClose }) => {
  const { goals, accounts, settings, addGoal, updateGoal, deleteGoal } = useStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const editing = editId ? goals.find((g) => g.id === editId) : null

  const activeGoals = goals.filter((g) => !g.archived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getProgress = (g: Goal): number => {
    if (g.linkedAccountId) {
      const a = accounts.find((x) => x.id === g.linkedAccountId)
      return Math.max(0, a?.balance ?? 0)
    }
    return g.manualProgress ?? 0
  }

  if (creating || editing) {
    return (
      <GoalEditView
        goal={editing ?? undefined}
        baseCurrency={settings.baseCurrency}
        accounts={accounts}
        onSave={(data) => {
          haptic.success()
          if (editing) updateGoal(editing.id, data)
          else addGoal({ ...data, archived: false })
          setCreating(false)
          setEditId(null)
        }}
        onDelete={editing ? () => {
          if (!window.confirm('Удалить цель?')) return
          haptic.warning()
          deleteGoal(editing.id)
          setEditId(null)
        } : undefined}
        onCancel={() => { setCreating(false); setEditId(null) }}
      />
    )
  }

  // v0.34: сумма накоплений по всем целям (включая достигнутые)
  const totalSaved = activeGoals.reduce((sum, g) => sum + Math.min(getProgress(g), g.targetAmount), 0)
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
          Цели
        </div>
        <button
          onClick={() => { haptic.light(); setCreating(true) }}
          className="bg-transparent border-0 cursor-pointer"
          style={{ width: 68, textAlign: 'right', color: '#ff1744', fontSize: 13, fontWeight: 500 }}
        >
          + Новая
        </button>
      </div>

      {activeGoals.length > 0 && (
        <div className="px-5 pt-2">
          <div
            style={{
              padding: 14,
              background: '#141414',
              border: '0.5px solid #222',
              borderRadius: 14,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <div className="text-2xs" style={{ color: '#555', letterSpacing: '1px', fontWeight: 500 }}>
              НАКОПИЛ ВСЕГО
            </div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>
              {Math.round(totalSaved).toLocaleString('ru-RU')} <span style={{ color: '#ff1744' }}>₽</span>
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
              из {Math.round(totalTarget).toLocaleString('ru-RU')} ₽ по {activeGoals.length} цел{activeGoals.length === 1 ? 'и' : activeGoals.length < 5 ? 'ям' : 'ям'}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-10">
        {activeGoals.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <div className="text-sm text-text-secondary mb-5 max-w-xs mx-auto">
              Ставь цели накопления и следи за прогрессом. Можно привязать цель к счёту — тогда прогресс считается сам.
            </div>
            <button
              onClick={() => { haptic.light(); setCreating(true) }}
              className="px-6 py-3 bg-accent border-0 rounded-btn text-white text-sm font-medium cursor-pointer"
            >
              Создать первую цель
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                progress={getProgress(g)}
                accountName={g.linkedAccountId ? accounts.find(a => a.id === g.linkedAccountId)?.name : undefined}
                onClick={() => setEditId(g.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Карточка цели
// ============================================================================

const GoalCard: React.FC<{
  goal: Goal
  progress: number
  accountName?: string
  onClick: () => void
}> = ({ goal, progress, accountName, onClick }) => {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((progress / goal.targetAmount) * 100)) : 0
  const remaining = Math.max(0, goal.targetAmount - progress)
  const done = pct >= 100

  // Дней до дедлайна
  let daysLeft: number | null = null
  if (goal.deadline) {
    const diff = new Date(goal.deadline).getTime() - Date.now()
    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const icon = iconById(goal.icon)
  // Если icon — это эмодзи (не id), показываем его напрямую
  const isEmojiString = /\p{Extended_Pictographic}/u.test(goal.icon)
  const iconDisplay = isEmojiString ? goal.icon : icon.emoji

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 bg-bg-secondary rounded-card border cursor-pointer active:scale-[0.99] transition-transform ${
        done ? 'border-success/50' : 'border-border'
      }`}
      style={{ minHeight: 116 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${done ? 'bg-success/20' : 'bg-accent/15'}`}>
          {iconDisplay}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <span className="truncate">{goal.name}</span>
            {done && <span className="text-success text-xs shrink-0">✓ достигнута</span>}
          </div>
          <div className="text-xs text-text-muted truncate">
            {accountName ? `Счёт: ${accountName}` : 'Ручной прогресс'}
            {daysLeft != null && (
              <span className={daysLeft < 0 ? ' text-accent' : ''}>
                {' · '}
                {daysLeft < 0 ? `просрочено на ${-daysLeft} дн` : daysLeft === 0 ? 'сегодня дедлайн' : `${daysLeft} дн до цели`}
              </span>
            )}
          </div>
        </div>
        <div className={`text-sm font-medium shrink-0 ${done ? 'text-success' : 'text-accent'}`}>
          {pct}%
        </div>
      </div>

      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden mb-2">
        <div
          className="h-full transition-all rounded-full"
          style={{
            width: `${pct}%`,
            background: done ? '#00c864' : 'linear-gradient(90deg, #ff0033, #cc0029)',
            boxShadow: done ? 'none' : '0 0 8px rgba(255,0,51,0.4)',
          }}
        />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">
          {formatMoney(progress, goal.currency).replace('−', '')}
        </span>
        <span className="text-text-muted">
          {done ? 'из' : 'осталось'} {formatMoney(done ? goal.targetAmount : remaining, goal.currency).replace('−', '')}
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Редактирование цели
// ============================================================================

const GOAL_ICONS = [
  'travel', 'home', 'cart', 'card', 'deposit', 'gift',
  'book', 'sport', 'beauty', 'movie', 'phone', 'cafe',
]

const GoalEditView: React.FC<{
  goal?: Goal
  baseCurrency: Currency
  accounts: { id: string; name: string; currency: Currency }[]
  onSave: (data: Omit<Goal, 'id' | 'createdAt' | 'archived'>) => void
  onDelete?: () => void
  onCancel: () => void
}> = ({ goal, baseCurrency, accounts, onSave, onDelete, onCancel }) => {
  const [name, setName]                 = useState(goal?.name ?? '')
  const [nameBlocked, setNameBlocked]   = useState(false)
  const [target, setTarget]             = useState(String(goal?.targetAmount ?? ''))
  const [currency, setCurrency]         = useState<Currency>(goal?.currency ?? baseCurrency)
  const [icon, setIcon]                 = useState(goal?.icon ?? 'travel')
  // Если в icon сохранён готовый эмодзи (длина 1-4 символа и не из GOAL_ICONS) — это custom
  const initialCustom = goal && !GOAL_ICONS.includes(goal.icon) && goal.icon.length <= 4 ? goal.icon : ''
  const [customEmoji, setCustomEmoji] = useState(initialCustom)
  const [deadline, setDeadline]         = useState(goal?.deadline?.slice(0, 10) ?? '')
  const [linkedAccountId, setLinked]    = useState(goal?.linkedAccountId ?? '')
  const [manualProgress, setManualProg] = useState(String(goal?.manualProgress ?? ''))

  const handleNameChange = (v: string) => {
    setName(v)
    if (nameBlocked) setNameBlocked(false)
  }

  const nameOk = moderate(name).ok
  const canSave = name.trim().length > 0 && Number(target) > 0 && nameOk

  const save = () => {
    const mod = moderate(name)
    if (!mod.ok) {
      haptic.error()
      setNameBlocked(true)
      return
    }
    if (!canSave) return
    // Если юзер выбрал custom и есть эмодзи — сохраняем эмодзи
    const finalIcon = icon === 'custom' && customEmoji ? customEmoji : icon
    onSave({
      name: name.trim(),
      icon: finalIcon,
      targetAmount: Number(target),
      currency,
      deadline: deadline ? new Date(deadline + 'T23:59:59').toISOString() : undefined,
      linkedAccountId: linkedAccountId || undefined,
      manualProgress: linkedAccountId ? undefined : (Number(manualProgress) || 0),
    })
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onCancel} />
        <div className="text-base font-medium">{goal ? 'Цель' : 'Новая цель'}</div>
        <button
          onClick={save}
          disabled={!canSave}
          className={`bg-transparent border-0 cursor-pointer text-base ${canSave ? 'text-accent' : 'text-text-faint'}`}
        >
          Готово
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 pb-10">
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Название</label>
          <input
            type="text"
            placeholder="Например, Отпуск в Абхазию"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={40}
            className={`w-full px-3.5 py-3 bg-bg-secondary border rounded-btn text-white text-sm box-border ${
              nameBlocked ? 'border-accent' : 'border-border'
            }`}
          />
          {nameBlocked && (
            <div className="mt-2 p-2.5 bg-accent/10 border border-accent/50 rounded-btn">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">⚠️</span>
                <span className="text-[11px] text-accent font-medium">
                  Нельзя использовать такое название
                </span>
              </div>
              <div className="text-[10px] text-text-secondary leading-relaxed mb-1.5">
                В приложении запрещены темы:
              </div>
              <div className="space-y-0.5">
                {getCategoryList().map((cat) => (
                  <div key={cat.name} className="text-[10px] text-text-muted">
                    {cat.emoji} {cat.name}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-text-faint mt-2">
                Попробуй переформулировать.
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Иконка</label>
          <div className="grid grid-cols-6 gap-2">
            {GOAL_ICONS.map((id) => {
              const def = iconById(id)
              return (
                <button
                  key={id}
                  onClick={() => { haptic.select(); setIcon(id) }}
                  className={`aspect-square rounded-btn flex items-center justify-center text-xl cursor-pointer border-0 ${
                    icon === id ? 'bg-accent' : 'bg-bg-secondary'
                  }`}
                >
                  {def.emoji}
                </button>
              )
            })}
          </div>

          {/* ИИ-подбор эмодзи */}
          <AiEmojiPicker
            onPicked={(emoji) => {
              haptic.success()
              setCustomEmoji(emoji)
              setIcon('custom')
            }}
            currentCustomEmoji={customEmoji}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Сумма цели</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
            />
          </div>
          <div>
            <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Валюта</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm cursor-pointer"
            >
              {BUILTIN_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Дедлайн (не обязательно)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Привязать к счёту (авто-прогресс)</label>
          <select
            value={linkedAccountId}
            onChange={(e) => setLinked(e.target.value)}
            className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm cursor-pointer"
          >
            <option value="">Нет — вручную</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <div className="text-xs text-text-muted mt-1.5">
            {linkedAccountId
              ? 'Прогресс = текущий баланс счёта'
              : 'Ты будешь сам указывать сколько накоплено'}
          </div>
        </div>

        {!linkedAccountId && (
          <div>
            <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Сколько уже накоплено</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={manualProgress}
              onChange={(e) => setManualProg(e.target.value)}
              className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
            />
          </div>
        )}

        {onDelete && (
          <button
            onClick={onDelete}
            className="w-full py-3 bg-transparent border border-accent/50 rounded-btn text-accent text-sm font-medium cursor-pointer"
          >
            Удалить цель
          </button>
        )}
      </div>
    </div>
  )
}
