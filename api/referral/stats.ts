/**
 * GET /api/referral/stats
 *
 * Возвращает счётчик подтверждённых приглашений для текущего юзера.
 * Защищено проверкой initData.
 */

import { corsPreflight, json, verifyInitData } from '../_shared'
import { getReferralCount } from '../_kv'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return corsPreflight()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const initData = req.headers.get('X-Telegram-Init-Data')
  const verified = await verifyInitData(initData)

  if (!verified) {
    return json({ error: 'invalid_init_data' }, 401)
  }

  try {
    const count = await getReferralCount(verified.id)
    return json({ ok: true, count })
  } catch (e) {
    return json({ error: 'server_error', message: (e as Error).message }, 500)
  }
}
