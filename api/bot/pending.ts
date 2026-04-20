/**
 * GET  /api/bot/pending — список pending транзакций для юзера
 * POST /api/bot/pending — удалить транзакцию по id (после того как юзер добавил её в Mini App)
 *
 * Авторизация: initData в заголовке X-Telegram-Init-Data (строгая HMAC-проверка).
 */

import { json, corsPreflight, verifyInitData } from '../_shared'
import { getPendingTxList, removePendingTx } from '../_kv'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return corsPreflight()

  const initData = req.headers.get('x-telegram-init-data') || ''
  const user = await verifyInitData(initData)
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (req.method === 'GET') {
    try {
      const items = await getPendingTxList(user.id)
      return json({ ok: true, items })
    } catch (e) {
      console.error('pending list error:', (e as Error).message)
      return json({ error: 'kv error' }, 502)
    }
  }

  if (req.method === 'POST') {
    let body: any
    try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) }
    const txId = String(body?.txId ?? '').trim()
    if (!txId) return json({ error: 'no txId' }, 400)
    try {
      await removePendingTx(user.id, txId)
      return json({ ok: true })
    } catch (e) {
      console.error('pending remove error:', (e as Error).message)
      return json({ error: 'kv error' }, 502)
    }
  }

  return json({ error: 'method not allowed' }, 405)
}
