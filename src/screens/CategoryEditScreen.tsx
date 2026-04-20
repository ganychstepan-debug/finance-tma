import { useState } from 'react'
import { useStore } from '@/store'
import { CATEGORY_ICONS } from '@/lib/icons'
import { CategoryIcon } from '@/components/CategoryIcon'
import { haptic } from '@/lib/telegram'
import type { CategoryType } from '@/types'
import { BackButton } from '@/components/BackButton'
import { AiEmojiPicker } from '@/components/AiEmojiPicker'
import { moderate, getCategoryList } from '@/lib/moderation'

interface Props {
  editId?: string
  defaultType?: CategoryType
  onClose: () => void
  onDone: () => void
}

export const CategoryEditScreen: React.FC<Props> = ({ editId, defaultType, onClose, onDone }) => {
  const { categories, addCategory, updateCategory, deleteCategory } = useStore()
  const existing = editId ? categories.find((c) => c.id === editId) : undefined

  const [name, setName]     = useState(existing?.name ?? '')
  const [nameBlocked, setNameBlocked] = useState(false)
  const [type, setType]     = useState<CategoryType>(existing?.type ?? defaultType ?? 'expense')
  const [iconId, setIconId] = useState(existing?.icon ?? 'other')
  const [budget, setBudget] = useState(
    existing?.budgetMonthly != null ? String(existing.budgetMonthly) : ''
  )

  const handleNameChange = (v: string) => {
    setName(v)
    if (nameBlocked) setNameBlocked(false)
  }

  const nameOk = moderate(name).ok
  const canSave = name.trim().length > 0 && nameOk

  const save = () => {
    const mod = moderate(name)
    if (!mod.ok) {
      haptic.error()
      setNameBlocked(true)
      return
    }
    if (!canSave) return
    haptic.success()
    const budgetValue = budget.trim() === '' ? null : Math.max(0, Number(budget) || 0)
    const data = {
      name: name.trim(),
      type,
      icon: iconId,
      budgetMonthly: type === 'expense' ? budgetValue : null,
      isCustom: true,
      archived: false,
      sortOrder: existing?.sortOrder ?? Date.now(),
    }
    if (editId) updateCategory(editId, data)
    else addCategory(data)
    onDone()
  }

  const handleDelete = () => {
    if (!editId) return
    if (!window.confirm('Удалить категорию? Транзакции останутся, но станут «без категории».')) return
    haptic.warning()
    deleteCategory(editId)
    onDone()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">{editId ? 'Категория' : 'Новая категория'}</div>
        <button
          onClick={save}
          disabled={!canSave}
          className={`bg-transparent border-0 cursor-pointer text-base ${canSave ? 'text-accent' : 'text-text-faint'}`}
        >
          Готово
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 pb-8">
        {/* Тип */}
        {!editId && (
          <div className="flex gap-1.5">
            <button
              onClick={() => { haptic.select(); setType('expense') }}
              className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border ${
                type === 'expense' ? 'bg-accent border-0 text-white' : 'bg-bg-secondary border-border text-text-muted'
              }`}
            >
              Расход
            </button>
            <button
              onClick={() => { haptic.select(); setType('income') }}
              className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border ${
                type === 'income' ? 'bg-accent border-0 text-white' : 'bg-bg-secondary border-border text-text-muted'
              }`}
            >
              Доход
            </button>
          </div>
        )}

        {/* Название */}
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Название</label>
          <input
            type="text"
            placeholder="Например, Кофе"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={30}
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

        {/* Иконка */}
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">Иконка</label>
          <div className="grid grid-cols-6 gap-2">
            {CATEGORY_ICONS.map((ic) => (
              <button
                key={ic.id}
                onClick={() => { haptic.select(); setIconId(ic.id) }}
                className={`aspect-square rounded-btn flex items-center justify-center text-xl cursor-pointer border-0 ${
                  iconId === ic.id ? 'bg-accent' : 'bg-bg-secondary'
                }`}
                title={ic.label}
              >
                {ic.emoji}
              </button>
            ))}
          </div>

          {/* ИИ-подбор эмодзи */}
          <AiEmojiPicker
            onPicked={(emoji) => {
              haptic.success()
              setIconId(emoji)  // В icon пишем сам эмодзи напрямую
            }}
            currentCustomEmoji={/\p{Extended_Pictographic}/u.test(iconId) ? iconId : undefined}
          />
        </div>

        {/* Предпросмотр */}
        <div className="p-3.5 bg-bg-secondary border border-border rounded-btn flex items-center gap-3">
          <CategoryIcon iconId={iconId} size="md" variant={type === 'income' ? 'income' : 'expense'} />
          <div>
            <div className="text-sm font-medium">{name || 'Без названия'}</div>
            <div className="text-xs text-text-muted">
              {type === 'expense' ? 'Расход' : 'Доход'}
            </div>
          </div>
        </div>

        {/* Бюджет (только для расходов) */}
        {type === 'expense' && (
          <div>
            <label className="text-2xs text-text-muted uppercase tracking-wide block mb-2">
              Месячный бюджет (не обязательно)
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full px-3.5 py-3 bg-bg-secondary border border-border rounded-btn text-white text-sm box-border"
            />
            <div className="text-xs text-text-muted mt-1.5">
              Оставь пустым, чтобы не устанавливать лимит
            </div>
          </div>
        )}

        {editId && (
          <button
            onClick={handleDelete}
            className="w-full py-3 bg-transparent border border-accent/50 rounded-btn text-accent text-sm font-medium cursor-pointer"
          >
            Удалить категорию
          </button>
        )}
      </div>
    </div>
  )
}
