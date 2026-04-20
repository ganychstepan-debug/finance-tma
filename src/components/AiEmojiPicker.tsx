import { useState } from 'react'
import { haptic } from '@/lib/telegram'
import { suggestEmoji } from '@/lib/ai'
import { moderate, getCategoryList } from '@/lib/moderation'

interface Props {
  onPicked: (emoji: string) => void
  /** Текущее выбранное custom-эмодзи (показываем рядом если есть) */
  currentCustomEmoji?: string
}

/**
 * Интерактивное поле "Опиши иконку словами" + кнопка "ИИ подберёт".
 * Отправляет описание на /api/emoji, получает эмодзи, вызывает onPicked().
 *
 * Показывает состояния: idle / loading / success / error.
 */
export const AiEmojiPicker: React.FC<Props> = ({ onPicked, currentCustomEmoji }) => {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{ category: string } | null>(null)
  const [expanded, setExpanded] = useState(Boolean(currentCustomEmoji))

  const handleSuggest = async () => {
    const text = description.trim()
    if (!text || loading) return

    // Клиентская модерация — мгновенно, без запроса к серверу
    const modResult = moderate(text)
    if (!modResult.ok) {
      haptic.error()
      setBlocked({ category: modResult.category || 'запрещённое содержимое' })
      setError(null)
      return
    }

    haptic.light()
    setLoading(true)
    setError(null)
    setBlocked(null)
    try {
      const result = await suggestEmoji(text)
      onPicked(result.emoji)
      setDescription('')
    } catch (e) {
      const msg = (e as Error).message
      // Сервер мог вернуть 403 с модерацией — показываем аналогичное предупреждение
      if (msg.includes('запрещ') || msg.includes('BLOCKED')) {
        setBlocked({ category: 'запрещённое содержимое' })
      } else {
        setError(msg)
      }
      haptic.error()
    } finally {
      setLoading(false)
    }
  }

  // Если юзер начал редактировать текст — сбрасываем предупреждение о блокировке
  const handleDescChange = (v: string) => {
    setDescription(v)
    if (error) setError(null)
    if (blocked) setBlocked(null)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => { haptic.light(); setExpanded(true) }}
        className="mt-3 w-full py-2 text-xs text-text-muted bg-transparent border-0 cursor-pointer"
      >
        ▾ Нет подходящей? ИИ подберёт
      </button>
    )
  }

  return (
    <div className="mt-3 p-3 bg-bg-tertiary rounded-btn border border-border space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">🤖 ИИ-подбор иконки</span>
        {currentCustomEmoji && (
          <span className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-text-muted">Текущее:</span>
            <span className="text-xl">{currentCustomEmoji}</span>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Например: коктейли на пляже"
          value={description}
          onChange={(e) => handleDescChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSuggest() }}
          maxLength={100}
          disabled={loading}
          className={`flex-1 px-3 py-2 bg-bg-secondary border rounded-btn text-white text-xs box-border placeholder:text-text-faint disabled:opacity-50 ${
            blocked ? 'border-accent' : 'border-border'
          }`}
        />
        <button
          onClick={handleSuggest}
          disabled={!description.trim() || loading || Boolean(blocked)}
          className={`px-3 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 active:scale-[0.98] transition-transform ${
            description.trim() && !loading && !blocked
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-text-faint'
          }`}
        >
          {loading ? '...' : 'Подобрать'}
        </button>
      </div>

      {/* Блок предупреждения при блокировке */}
      {blocked && (
        <div className="p-2.5 bg-accent/10 border border-accent/50 rounded-btn">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs">⚠️</span>
            <span className="text-[11px] text-accent font-medium">
              Нельзя использовать такой запрос
            </span>
          </div>
          <div className="text-[10px] text-text-secondary leading-relaxed mb-1.5">
            В приложении запрещены запросы связанные с:
          </div>
          <div className="space-y-0.5">
            {getCategoryList().map((cat) => (
              <div key={cat.name} className="text-[10px] text-text-muted">
                {cat.emoji} {cat.name}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-text-faint mt-2">
            Попробуй переформулировать запрос.
          </div>
        </div>
      )}

      {error && !blocked && (
        <div className="text-[10px] text-accent">⚠ {error}</div>
      )}
      {!error && !blocked && (
        <div className="text-[10px] text-text-muted leading-relaxed">
          Опиши на русском или английском — ИИ подберёт эмодзи. Примеры: «море и пальмы», «автомобиль», «подписка нетфликс».
        </div>
      )}
    </div>
  )
}
