import { useEffect, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { getRates, ratesAgeHours, convert, type Rates } from '@/lib/fx'
import { currencySign } from '@/lib/formatters'
import { useStore } from '@/store'

interface Props { onClose: () => void }

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Доллар США',
  EUR: 'Евро',
  KZT: 'Казахский тенге',
  BYN: 'Белорусский рубль',
  UAH: 'Гривна',
  GBP: 'Фунт стерлингов',
  JPY: 'Японская иена',
  CNY: 'Юань',
  TRY: 'Турецкая лира',
  CHF: 'Швейцарский франк',
  GEL: 'Грузинский лари',
  AED: 'Дирхам ОАЭ',
  INR: 'Индийская рупия',
}

const DISPLAY_ORDER = ['USD', 'EUR', 'KZT', 'GBP', 'CNY', 'TRY', 'BYN', 'UAH', 'CHF', 'GEL', 'AED', 'INR', 'JPY']

export const RatesScreen: React.FC<Props> = ({ onClose }) => {
  const baseCurrency = useStore((s) => s.settings.baseCurrency)
  const [rates, setRates] = useState<Rates | null>(null)
  const [age, setAge] = useState<number>(-1)
  const [retrying, setRetrying] = useState(false)

  const load = (force = false) => {
    getRates(force).then((r) => {
      setRates(r)
      setAge(ratesAgeHours())
    })
  }

  useEffect(() => {
    load()
  }, [])

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await getRates(true)
      setAge(ratesAgeHours())
      // Подгрузим свежие
      const r = await getRates()
      setRates(r)
    } finally {
      setRetrying(false)
    }
  }

  const isFresh = age >= 0 && age < 48
  const isStale = age >= 48
  const noData = age < 0

  const ageText = noData
    ? 'Нет данных'
    : age === 0
      ? 'Только что'
      : age === 1
        ? '1 час назад'
        : age < 24
          ? `${age} часов назад`
          : `${Math.floor(age / 24)} дн. назад`

  const statusColor = isFresh ? '#4ade80' : isStale ? '#ff9500' : '#666'
  const statusLabel = isFresh ? 'АКТУАЛЬНО' : isStale ? 'УСТАРЕЛИ' : 'FALLBACK'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-3 pb-2 flex justify-between items-center">
        <BackButton onClick={onClose} />
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Курсы валют</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="px-4 pt-3 pb-10">
        {/* v0.76: 5.09 Fallback баннер когда нет данных */}
        {noData ? (
          <>
            <div
              className="mb-3"
              style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))',
                border: '0.5px solid rgba(251,191,36,0.3)',
                borderRadius: 14,
              }}
            >
              <div className="flex items-start" style={{ gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                    API ЦБ недоступен
                  </div>
                  <div style={{ color: '#aaa', fontSize: 11, lineHeight: 1.5 }}>
                    Используем приблизительные курсы. Проверь соединение и попробуй обновить.
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопка Попробовать снова */}
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full mb-4 flex items-center justify-center cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{
                padding: 13,
                background: 'transparent',
                border: '1px solid #fbbf24',
                borderRadius: 14,
                color: '#fbbf24',
                fontSize: 13,
                fontWeight: 500,
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: retrying ? 'spin 0.8s linear infinite' : 'none' }}
              >
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {retrying ? 'Проверяем…' : 'Попробовать снова'}
            </button>
          </>
        ) : (
          /* Источник для нормального состояния */
          <div
            className="flex items-center mb-4"
            style={{
              padding: '14px 16px',
              background: `linear-gradient(135deg, ${statusColor}0f, ${statusColor}05)`,
              border: `0.5px solid ${statusColor}40`,
              borderRadius: 14,
              gap: 10,
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: statusColor,
                color: '#0a0a0a', fontSize: 16, fontWeight: 800,
              }}
            >
              ЦБ
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                cbr-xml-daily.ru
              </div>
              <div className="flex items-center" style={{ color: statusColor, fontSize: 10, marginTop: 2, gap: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 8px ${statusColor}`,
                }} />
                {isFresh ? `Свежие · ${ageText}` : `Устарели · ${ageText}`}
              </div>
            </div>
            <div
              style={{
                color: statusColor, fontSize: 10, fontWeight: 600,
                padding: '3px 8px',
                background: `${statusColor}1f`,
                borderRadius: 6,
              }}
            >
              {statusLabel}
            </div>
          </div>
        )}

        {/* Курсы */}
        <div
          className="mb-2"
          style={{ color: '#666', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}
        >
          {noData ? `Запасные курсы · к ${currencySign(baseCurrency)}` : `Курсы к ${currencySign(baseCurrency)}`}
        </div>
        <div className="flex flex-col" style={{ gap: 5 }}>
          {rates && DISPLAY_ORDER
            .filter((code) => code !== baseCurrency && rates[code] !== undefined)
            .map((code) => {
              // v0.66: конвертируем 1 единицу валюты в основную через convert()
              const value = convert(1, code, baseCurrency, rates)
              return (
                <div
                  key={code}
                  className="flex items-center"
                  style={{
                    padding: '11px 14px',
                    background: '#141414',
                    border: noData ? '0.5px solid rgba(251,191,36,0.15)' : '0.5px solid #222',
                    borderRadius: 12,
                    gap: 10,
                    opacity: noData ? 0.9 : 1,
                  }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 30, height: 30,
                      borderRadius: 7,
                      background: '#1f1f1f',
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    {currencySign(code)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{code}</div>
                    <div style={{ color: '#666', fontSize: 10 }}>{CURRENCY_NAMES[code] || code}</div>
                  </div>
                  <div style={{
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {noData ? '≈ ' : ''}{value < 1 ? value.toFixed(4) : value.toFixed(2)} {currencySign(baseCurrency)}
                  </div>
                </div>
              )
            })
          }
        </div>

        <div style={{
          marginTop: 14, padding: 11, textAlign: 'center',
          color: '#666', fontSize: 11,
        }}>
          Обновляются раз в сутки · кэш локально
        </div>
      </div>
    </div>
  )
}
