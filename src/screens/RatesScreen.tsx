import { useEffect, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { getRates, ratesAgeHours, type Rates } from '@/lib/fx'
import { currencySign } from '@/lib/formatters'

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
  const [rates, setRates] = useState<Rates | null>(null)
  const [age, setAge] = useState<number>(-1)

  useEffect(() => {
    getRates().then((r) => {
      setRates(r)
      setAge(ratesAgeHours())
    })
  }, [])

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
        {/* Источник */}
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
              {isFresh ? `Свежие · ${ageText}` : isStale ? `Устарели · ${ageText}` : 'Нет соединения'}
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

        {/* Курсы */}
        <div
          className="mb-2"
          style={{ color: '#666', fontSize: 10, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', paddingLeft: 2 }}
        >
          Курсы к ₽
        </div>
        <div className="flex flex-col" style={{ gap: 5 }}>
          {rates && DISPLAY_ORDER
            .filter((code) => rates[code] !== undefined)
            .map((code) => {
              const value = rates[code]
              return (
                <div
                  key={code}
                  className="flex items-center"
                  style={{
                    padding: '11px 14px',
                    background: '#141414',
                    border: '0.5px solid #222',
                    borderRadius: 12,
                    gap: 10,
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
                    {value < 1 ? value.toFixed(4) : value.toFixed(2)} ₽
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
