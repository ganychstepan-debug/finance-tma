import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTelegram } from './lib/telegram'
import { getRates } from './lib/fx'
import { useStore } from './store'
import './index.css'

initTelegram()

// Фоновая загрузка курсов валют (не блокирует рендер)
getRates().catch((e) => console.warn('fx init failed', e))

// Автовосстановление из Telegram CloudStorage:
const bootstrap = async () => {
  const hasLocal = !!localStorage.getItem('finance_app_state')
  if (!hasLocal) {
    try {
      const result = await useStore.getState().restoreFromCloud()
      if (result.restored) {
        console.log(`Restored from cloud: ${result.transactions} transactions`)
      }
    } catch (e) {
      console.warn('cloud restore failed', e)
    }
  }
  // Реф-код теперь обрабатывается на сервере (бот ловит /start ref_<id>
  // и фиксит pending в KV; Mini App подтверждает через /api/referral/complete
  // в App.tsx после онбординга).
}

bootstrap()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
