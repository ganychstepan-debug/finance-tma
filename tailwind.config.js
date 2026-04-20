/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   'rgb(var(--c-bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-bg-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--c-bg-tertiary) / <alpha-value>)',
          nav:       'rgb(var(--c-bg-nav) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          dark:    'rgb(var(--c-accent-dark) / <alpha-value>)',
          darker:  'rgb(var(--c-accent-darker) / <alpha-value>)',
          glow:    'rgba(var(--c-accent), 0.3)',
        },
        success: 'rgb(var(--c-success) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--c-border) / <alpha-value>)',
          muted:   'rgb(var(--c-border-muted) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--c-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-text-muted) / <alpha-value>)',
          faint:     'rgb(var(--c-text-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Roboto', 'sans-serif'],
        rounded: ['"SF Pro Rounded"', '"SF Pro Display"', '-apple-system', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
        sm: '13px',
        base: '15px',
      },
      borderRadius: {
        'card': '14px',
        'btn': '12px',
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 250ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255, 0, 51, 0.5)' },
          '50%': { boxShadow: '0 0 16px rgba(255, 0, 51, 0.9)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
