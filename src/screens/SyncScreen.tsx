import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { BackButton } from '@/components/BackButton'
import { haptic, showPopup } from '@/lib/telegram'

interface Props { onClose: () => void }

// Относительное время с последнего сохранения
const relativeTime = (iso: string | undefined): string => {
  if (!iso) return 'Ещё не синхронизировано'
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return 'только что'
  if (sec < 60) return `${sec} сек назад`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} мин назад`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}

export const SyncScreen: React.FC<Props> = ({ onClose }) => {
  const state = useStore()
  const [, forceTick] = useState(0)

  // Обновляем "X секунд назад" каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  const lastSync = state.meta?.lastSyncAt
  const timeAgo = relativeTime(lastSync)
  const isSynced = !!lastSync

  const accountsCount = state.accounts.filter((a) => !a.archived).length
  const goalsCount = (state.goals ?? []).filter((g) => !g.archived).length
  const categoriesCount = state.categories.filter((c) => !c.archived).length
  const txCount = state.transactions.length

  // Считаем "шарды" — уникальные YYYY_MM
  const shards = new Set(
    state.transactions.map((t) => {
      const d = new Date(t.date)
      return `${d.getFullYear()}_${d.getMonth()}`
    })
  ).size

  const handleRestore = async () => {
    const pressed = await showPopup({
      title: 'Восстановить из облака?',
      message: 'Текущие локальные данные будут заменены на те, что хранятся в Telegram-облаке. Используй если данные пропали после переустановки.',
      buttons: [
        { id: 'cancel', type: 'cancel', text: 'Отмена' },
        { id: 'restore', type: 'destructive', text: 'Восстановить' },
      ],
    })
    if (pressed !== 'restore') return
    haptic.medium()
    const result = await state.restoreFromCloud()
    if (result.restored) {
      await showPopup({
        title: 'Готово',
        message: `Восстановлено транзакций: ${result.transactions}`,
        buttons: [{ type: 'ok', text: 'OK' }],
      })
      onClose()
    } else {
      await showPopup({
        title: 'В облаке нет данных',
        message: 'Возможно, это первый запуск — данные начнут синхронизироваться автоматически.',
        buttons: [{ type: 'ok', text: 'OK' }],
      })
    }
  }

  const statusColor = isSynced ? '#4ade80' : '#666'
  const statusBg = isSynced
    ? 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(74,222,128,0.02))'
    : 'linear-gradient(135deg, rgba(120,120,120,0.08), rgba(120,120,120,0.02))'
  const statusBorder = isSynced ? 'rgba(74,222,128,0.3)' : 'rgba(120,120,120,0.2)'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
        <BackButton onClick={onClose} />
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Синхронизация</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="px-4 pb-6">
        {/* Статус */}
        <div
          style={{
            padding: '22px 20px',
            background: statusBg,
            border: `0.5px solid ${statusBorder}`,
            borderRadius: 18,
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: 64, height: 64,
              marginBottom: 14,
              borderRadius: '50%',
              background: `${statusColor}26`,
              boxShadow: `0 0 30px ${statusColor}40`,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="1.8">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              <polyline points="8 13 12 17 16 13" stroke={statusColor}/>
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
            {isSynced ? 'Всё синхронизировано' : 'Ещё не синхронизировано'}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ color: statusColor, fontSize: 11, gap: 5 }}
          >
            <span style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }} />
            {isSynced ? `${timeAgo} · автосохранение` : 'Данные сохранятся автоматически'}
          </div>
        </div>

        {/* Хранится в облаке */}
        <div
          style={{
            color: '#555', fontSize: 10, letterSpacing: '1.3px',
            fontWeight: 500, textTransform: 'uppercase', marginBottom: 6,
            paddingLeft: 2,
          }}
        >
          Хранится в облаке
        </div>
        <div
          style={{
            padding: '4px 0',
            background: '#141414',
            border: '0.5px solid #222',
            borderRadius: 12,
          }}
        >
          <Row emoji="💳" title="Счета" subtitle={`${accountsCount} ${pluralize(accountsCount, ['счёт', 'счёта', 'счетов'])}`} hasDivider />
          <Row emoji="🎯" title="Цели" subtitle={`${goalsCount} ${pluralize(goalsCount, ['цель', 'цели', 'целей'])}`} hasDivider />
          <Row emoji="🏷" title="Категории" subtitle={`${categoriesCount} ${pluralize(categoriesCount, ['категория', 'категории', 'категорий'])}`} hasDivider />
          <Row emoji="📊" title="Операции · по месяцам" subtitle={`${txCount.toLocaleString('ru-RU')} ${pluralize(txCount, ['запись', 'записи', 'записей'])} · ${shards} ${pluralize(shards, ['шард', 'шарда', 'шардов'])}`} hasDivider />
          <Row emoji="⚙️" title="Настройки" subtitle="валюта, банки, профиль" />
        </div>

        {/* Privacy note */}
        <div
          className="flex items-start"
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'rgba(255,23,68,0.03)',
            border: '0.5px solid rgba(255,23,68,0.15)',
            borderRadius: 12,
            gap: 10,
          }}
        >
          <span style={{ fontSize: 14, marginTop: 1 }}>🔒</span>
          <div style={{ color: '#aaa', fontSize: 11, lineHeight: 1.5 }}>
            Данные хранятся в твоём <span style={{ color: '#fff' }}>Telegram CloudStorage</span> — мы не видим их на сервере. После чистки кэша всё восстановится автоматически.
          </div>
        </div>

        {/* Кнопка восстановить */}
        <button
          onClick={handleRestore}
          className="w-full flex items-center justify-center cursor-pointer border-0 active:scale-[0.98] transition-transform"
          style={{
            marginTop: 16,
            padding: 13,
            background: '#141414',
            border: '0.5px solid #222',
            borderRadius: 14,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff1744" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Восстановить из облака
        </button>
      </div>
    </div>
  )
}

const Row: React.FC<{
  emoji: string
  title: string
  subtitle: string
  hasDivider?: boolean
}> = ({ emoji, title, subtitle, hasDivider }) => (
  <div
    className="flex items-center"
    style={{
      padding: '11px 14px',
      gap: 12,
      borderBottom: hasDivider ? '0.5px solid #1f1f1f' : 'none',
    }}
  >
    <span style={{ fontSize: 15 }}>{emoji}</span>
    <div style={{ flex: 1 }}>
      <div style={{ color: '#fff', fontSize: 12 }}>{title}</div>
      <div style={{ color: '#666', fontSize: 10 }}>{subtitle}</div>
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
)

const pluralize = (n: number, forms: [string, string, string]): string => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}
