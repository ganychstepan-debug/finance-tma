import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { haptic, shareViaTelegram, showPopup } from '@/lib/telegram'
import { BackButton } from '@/components/BackButton'
import { getReferralLink, getShareMessage, incrementShareCount, fetchReferralCount } from '@/lib/referral'

interface Props {
  onClose: () => void
}

export const ReferralScreen: React.FC<Props> = ({ onClose }) => {
  const { settings } = useStore()
  const [inviteCount, setInviteCount] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchReferralCount().then((n) => {
      if (!cancelled) setInviteCount(n)
    })
    return () => { cancelled = true }
  }, [])

  const link = getReferralLink()

  const handleShare = () => {
    haptic.success()
    incrementShareCount()
    shareViaTelegram(link, getShareMessage())
  }

  const handleCopy = async () => {
    haptic.light()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback на iOS — открываем попап с ссылкой и просим скопировать вручную
      await showPopup({
        title: 'Скопируй ссылку',
        message: link,
        buttons: [{ type: 'ok' }],
      })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-primary">
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div className="text-base font-medium">Пригласить друга</div>
        <div className="w-16" />
      </div>

      {/* Hero */}
      <div className="text-center relative" style={{ padding: '20px 24px 12px' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,23,68,0.15), transparent 70%)' }}
        />
        <div className="relative z-10">
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: 88, height: 88,
              marginBottom: 16,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff1744, #8a001c)',
              fontSize: 42,
              boxShadow: '0 0 40px rgba(255,23,68,0.4), 0 0 80px rgba(255,23,68,0.2)',
            }}
          >
            🎁
          </div>
          <div style={{
            color: '#fff', fontSize: 22, fontWeight: 500,
            marginBottom: 6, letterSpacing: '-0.01em',
          }}>
            Зови друзей
          </div>
          <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5, maxWidth: 270, margin: '0 auto' }}>
            Пока ничего не даём — но когда выйдем из беты, активные пригласившие получат плюшки первыми.
          </div>
        </div>
      </div>

      {/* Счётчик */}
      <div className="px-4" style={{ paddingTop: 14 }}>
        <div
          className="text-center"
          style={{
            padding: 18,
            background: '#141414',
            border: '0.5px solid #222',
            borderRadius: 16,
          }}
        >
          <div style={{
            color: '#666', fontSize: 9, letterSpacing: '2px',
            fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
          }}>
            Приглашено друзей
          </div>
          <div style={{
            color: '#ff1744', fontSize: 46, fontWeight: 300,
            lineHeight: 1, marginBottom: 8,
          }}>
            {inviteCount === null ? '—' : inviteCount}
          </div>
          <div style={{ color: '#666', fontSize: 10, lineHeight: 1.4, maxWidth: 220, margin: '0 auto' }}>
            Засчитывается когда друг открыл бота по твоей ссылке и прошёл онбординг.
          </div>
        </div>
      </div>

      {/* Кто пригласил тебя */}
      {settings.referredBy && (
        <div className="px-5 mt-3">
          <div className="bg-bg-secondary/60 border border-border rounded-btn p-3 flex items-center gap-3">
            <div className="text-lg">👋</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-muted">Тебя пригласил друг</div>
              <div className="text-sm text-white">ID {settings.referredBy}</div>
            </div>
          </div>
        </div>
      )}

      {/* Плюшки */}
      <div className="px-5 mt-6">
        <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2 px-1">
          Что будет после релиза
        </div>
        <div className="bg-bg-secondary rounded-card p-4 space-y-3">
          <Benefit icon="⚡️" title="Ранний доступ" text="К новым фичам до общего релиза" />
          <Benefit icon="🏆" title="Особый значок" text="Видно что ты был с самого начала" />
          <Benefit icon="🎨" title="Эксклюзивные темы" text="Оформление только для ранних пользователей" />
          <Benefit icon="📈" title="Увеличенные лимиты" text="Больше счетов, целей, категорий" />
        </div>
        <div className="mt-2 text-[10px] text-text-muted px-1 leading-snug">
          Набор плюшек ещё уточняется. Подпишись на канал чтобы узнать первым.
        </div>
      </div>

      {/* Ссылка + действия */}
      <div className="px-5 mt-6 mb-4">
        <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2 px-1">
          Твоя ссылка
        </div>
        <button
          onClick={handleCopy}
          className="w-full bg-bg-secondary border border-border rounded-btn p-3 flex items-center gap-2 text-left cursor-pointer active:scale-[0.99] transition-transform"
        >
          <span className="text-xs text-text-muted truncate flex-1 font-mono">
            {link}
          </span>
          <span className="text-xs text-accent shrink-0 px-2 py-0.5 bg-accent/10 rounded">
            {copied ? 'Скопировано ✓' : 'Копия'}
          </span>
        </button>
      </div>

      {/* Закреплённая кнопка */}
      <div className="flex-1" />
      <div
        className="px-5 pt-3 shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <button
          onClick={handleShare}
          className="w-full py-4 bg-accent border-0 rounded-btn text-white text-base font-medium cursor-pointer shadow-[0_4px_20px_rgba(var(--c-accent-glow-strong),0.4)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <span>📤</span>
          <span>Поделиться в Telegram</span>
        </button>
      </div>
    </div>
  )
}

const Benefit: React.FC<{ icon: string; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="flex items-start gap-3">
    <div className="text-lg leading-none shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{text}</div>
    </div>
  </div>
)
