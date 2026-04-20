// Ручные SVG-иконки банков в фирменных стилях.
// Используем fill="currentColor" где можно, чтобы подстраивалось.
// Каждая иконка — квадрат с внутренним круглым или скруглённым фоном.

import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

// ============================================================================
// Тинькофф — жёлтый квадрат с чёрной Т
// ============================================================================
export const IconTinkoff: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#FFDD2D',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v3.5h-6V19h-4V8.5H4V5Z" fill="#1A1A1A" />
    </svg>
  </div>
)

// ============================================================================
// Сбер — зелёный круг с белой птичкой-галочкой
// ============================================================================
export const IconSber: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#21A038',
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
      <path
        d="M3.5 11c0-4 3.5-7.5 8.5-7.5 2 0 3.8.6 5.2 1.7L15.8 6.4A6.7 6.7 0 0 0 12 5.3c-3.6 0-6.2 2.5-6.2 5.7 0 3.2 2.6 5.7 6.2 5.7 1.2 0 2.3-.3 3.2-.8l-1.8-2.1-1 1.2-3.8-4 1-1.1 2.8 3 4-4.7 1.3 1.1c1 1.2 1.7 2.8 1.7 4.6 0 4-3.5 7.5-8.5 7.5S3.5 15 3.5 11Z"
        fill="#fff"
      />
    </svg>
  </div>
)

// ============================================================================
// Альфа-Банк — красный квадрат с белой А
// ============================================================================
export const IconAlfa: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#EF3124',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4L4 20h3.3l1.4-3h6.6l1.4 3H20L12 4Zm-2.2 10.4L12 9.5l2.2 4.9H9.8Z"
        fill="#fff"
      />
      <rect x="4" y="19" width="16" height="2" rx="0.5" fill="#fff" />
    </svg>
  </div>
)

// ============================================================================
// ВТБ — синий квадрат с белой V
// ============================================================================
export const IconVtb: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#0A2973',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.55} height={size * 0.5} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h4.5L12 16l4.5-10H21l-6.5 14h-5L3 6Z"
        fill="#fff"
      />
    </svg>
  </div>
)

// ============================================================================
// Газпромбанк — синий квадрат с белым "газовым пламенем"
// ============================================================================
export const IconGazprom: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#005FAA',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C9 7 7 9.5 7 13c0 3.3 2.2 6 5 6s5-2.7 5-6c0-3.5-2-6-5-10Zm0 14c-1.8 0-3.2-1.6-3.2-3.8 0-2 1.1-3.5 3.2-6.2 2.1 2.7 3.2 4.2 3.2 6.2C15.2 15.4 13.8 17 12 17Z"
        fill="#fff"
      />
    </svg>
  </div>
)

// ============================================================================
// Райффайзен — жёлтый квадрат с чёрным "всадником" (упрощённо как крест/флаг)
// ============================================================================
export const IconRaif: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#FEE600',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 4L10 4 L12 8 L14 4 L19 4 L19 8 L15 12 L19 16 L19 20 L14 20 L12 16 L10 20 L5 20 L5 16 L9 12 L5 8 L5 4Z"
        fill="#1A1A1A"
      />
    </svg>
  </div>
)

// ============================================================================
// Открытие — синий квадрат с белым "О" в виде круга
// ============================================================================
export const IconOtkritie: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#00ADEF',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M15 9 L20 4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>
)

// ============================================================================
// Почта Банк — синий квадрат с белой стилизованной П
// ============================================================================
export const IconPost: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#1B355E',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 5h14v3H14v11h-4V8H5V5Z"
        fill="#fff"
      />
    </svg>
  </div>
)

// ============================================================================
// Яндекс Банк — красный квадрат с белой Я (не буквой, а стилизованным знаком)
// ============================================================================
export const IconYandex: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#FC3F1D',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.5} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <path
        d="M13 5h-2.5C7.5 5 5.5 7 5.5 10c0 2 1 3.5 2.5 4.3L5 20h3l2.5-5h1V20H14V5h-1Zm-1 8.5h-1c-1.4 0-2.5-1.3-2.5-3S9.6 7.5 11 7.5h1V13.5Z"
        fill="#fff"
      />
    </svg>
  </div>
)

// ============================================================================
// Озон Банк — синий круг с белой кнопкой (упрощённая иконка)
// ============================================================================
export const IconOzon: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#005BFF',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
      <ellipse cx="8" cy="12" rx="3.5" ry="5.5" stroke="#fff" strokeWidth="2.5" fill="none" />
      <ellipse cx="16" cy="12" rx="3.5" ry="5.5" stroke="#fff" strokeWidth="2.5" fill="none" />
    </svg>
  </div>
)

// ============================================================================
// Другой / неизвестный банк — серый с "?"
// ============================================================================
export const IconOtherBank: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#444',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.5,
      fontWeight: 600,
    }}
  >
    ?
  </div>
)

// ============================================================================
// Без банка — нейтральный серый квадрат со звёздочкой
// ============================================================================
export const IconNoBank: React.FC<IconProps> = ({ size = 28, className }) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: '#555',
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.5,
      fontWeight: 500,
    }}
  >
    ★
  </div>
)

// ============================================================================
// Кастомный банк юзера — цветной квадрат с 1-2 буквами
// ============================================================================
export const IconCustomBank: React.FC<IconProps & { color: string; short: string }> = ({
  size = 28, className, color, short,
}) => (
  <div
    className={className}
    style={{
      width: size, height: size,
      background: color,
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.4,
      fontWeight: 600,
      letterSpacing: '-0.02em',
    }}
  >
    {short}
  </div>
)

// ============================================================================
// Роутер по id
// ============================================================================
export const BankIcon: React.FC<{ bankId?: string; size?: number; className?: string }> = ({
  bankId, size, className,
}) => {
  // Кастомные банки ищем в settings через ленивый импорт store
  if (bankId?.startsWith('custom_')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useStore } = require('@/store')
      const state = useStore.getState()
      const cb = state.settings.customBanks?.find((b: { id: string }) => b.id === bankId)
      if (cb) return <IconCustomBank size={size} className={className} color={cb.color} short={cb.short} />
    } catch {}
    return <IconOtherBank size={size} className={className} />
  }
  switch (bankId) {
    case 'tinkoff':  return <IconTinkoff size={size} className={className} />
    case 'sber':     return <IconSber size={size} className={className} />
    case 'alfa':     return <IconAlfa size={size} className={className} />
    case 'vtb':      return <IconVtb size={size} className={className} />
    case 'gazprom':  return <IconGazprom size={size} className={className} />
    case 'raif':     return <IconRaif size={size} className={className} />
    case 'otkritie': return <IconOtkritie size={size} className={className} />
    case 'post':     return <IconPost size={size} className={className} />
    case 'yandex':   return <IconYandex size={size} className={className} />
    case 'ozon':     return <IconOzon size={size} className={className} />
    case 'none':     return <IconNoBank size={size} className={className} />
    default:         return <IconOtherBank size={size} className={className} />
  }
}
