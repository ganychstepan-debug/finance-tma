import { haptic } from '@/lib/telegram'
import { CHANGELOG, APP_VERSION } from '@/lib/version'

interface Props {
  onDone: () => void
}

const formatVersion = (v: number): string => `v0.${v}`

export const ChangelogScreen: React.FC<Props> = ({ onDone }) => {
  const current = CHANGELOG[0]
  const older = CHANGELOG.slice(1, 4)

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Скроллируемый контент */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
      >
        <div className="px-6 pt-10 pb-4 text-center">
          <div className="text-5xl mb-3">✨</div>
          <div className="text-xs text-text-muted uppercase tracking-widest mb-1">
            Версия {formatVersion(APP_VERSION)}
          </div>
          <div className="text-2xl font-medium mb-1 leading-tight">
            Что нового
          </div>
          <div className="text-sm text-text-secondary px-4">
            {current.title}
          </div>
        </div>

        <div className="px-5 mt-2">
          <div className="bg-bg-secondary border border-accent/30 rounded-card p-4 shadow-[0_0_24px_rgba(255,0,51,0.15)]">
            <div className="space-y-3">
              {current.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-accent text-sm mt-0.5 shrink-0">▸</span>
                  <div className="text-sm text-white leading-relaxed flex-1">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {older.length > 0 && (
          <div className="px-5 mt-6 mb-4">
            <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2.5 px-1">
              Прошлые обновления
            </div>
            <div className="space-y-3">
              {older.map((entry) => (
                <div key={entry.version} className="bg-bg-secondary/60 border border-border rounded-btn p-3">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-[10px] text-accent font-medium uppercase tracking-wide">
                      v{entry.version}
                    </span>
                    <span className="text-xs text-text-secondary">{entry.title}</span>
                  </div>
                  <div className="space-y-1">
                    {entry.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="text-[11px] text-text-muted leading-snug pl-2">
                        · {item}
                      </div>
                    ))}
                    {entry.items.length > 3 && (
                      <div className="text-[11px] text-text-faint pl-2">
                        · и ещё {entry.items.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Закреплённая кнопка */}
      <div
        className="shrink-0 px-5 pt-3 bg-bg-primary border-t border-border/40"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button
          onClick={() => { haptic.success(); onDone() }}
          className="w-full py-4 bg-accent border-0 rounded-btn text-white text-base font-medium cursor-pointer shadow-[0_4px_20px_rgba(255,0,51,0.4)] active:scale-[0.98] transition-transform"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
