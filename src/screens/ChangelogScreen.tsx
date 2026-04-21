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
        <div className="text-center" style={{ padding: '34px 22px 14px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✨</div>
          <div style={{
            color: '#666', fontSize: 10, letterSpacing: '2.5px',
            fontWeight: 600, textTransform: 'uppercase', marginBottom: 6,
          }}>
            ВЕРСИЯ {formatVersion(APP_VERSION).toUpperCase()}
          </div>
          <div style={{
            color: '#fff', fontSize: 22, fontWeight: 500,
            marginBottom: 3, letterSpacing: '-0.01em',
          }}>
            Что нового
          </div>
          <div style={{ color: '#aaa', fontSize: 12, padding: '0 14px' }}>
            {current.title}
          </div>
        </div>

        <div className="px-4" style={{ marginTop: 6 }}>
          <div
            style={{
              padding: 14,
              background: '#141414',
              border: '0.5px solid rgba(255,23,68,0.3)',
              borderRadius: 16,
              boxShadow: '0 0 24px rgba(255,23,68,0.15)',
            }}
          >
            <div className="flex flex-col" style={{ gap: 10 }}>
              {current.items.map((item, i) => (
                <div key={i} className="flex items-start" style={{ gap: 10 }}>
                  <span style={{ color: '#ff1744', fontSize: 12, marginTop: 1 }}>▸</span>
                  <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.5, flex: 1 }}>
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {older.length > 0 && (
          <div style={{ padding: '22px 16px 14px' }}>
            <div style={{
              color: '#666', fontSize: 9, letterSpacing: '2px',
              fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2,
            }}>
              Прошлые обновления
            </div>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {older.map((entry) => (
                <div
                  key={entry.version}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(20,20,20,0.6)',
                    border: '0.5px solid #222',
                    borderRadius: 12,
                  }}
                >
                  <div className="flex items-baseline" style={{ gap: 8, marginBottom: 4 }}>
                    <span style={{
                      color: '#ff1744', fontSize: 10, fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      v{entry.version}
                    </span>
                    <span style={{ color: '#aaa', fontSize: 11 }}>{entry.title}</span>
                  </div>
                  <div style={{ color: '#666', fontSize: 10, lineHeight: 1.4, paddingLeft: 8 }}>
                    {entry.items.slice(0, 3).map((item, i) => (
                      <div key={i}>· {item}</div>
                    ))}
                    {entry.items.length > 3 && (
                      <div>· и ещё {entry.items.length - 3}</div>
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
        className="shrink-0"
        style={{
          padding: '10px 18px',
          background: '#0a0a0a',
          borderTop: '0.5px solid rgba(51,51,51,0.4)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
        }}
      >
        <button
          onClick={() => { haptic.success(); onDone() }}
          className="w-full cursor-pointer border-0 active:scale-[0.98] transition-transform"
          style={{
            padding: 14,
            background: '#ff1744',
            borderRadius: 14,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(255,23,68,0.4)',
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
