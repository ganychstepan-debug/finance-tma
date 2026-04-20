/**
 * POST /api/referral/complete
 *
 * Вызывается из Mini App после прохождения онбординга.
 * Проверяет initData (защита от накруток), подтверждает приглашение,
 * инкрементит счётчик пригласителя и шлёт ему уведомление.
 */

import { corsPreflight, json, verifyInitData } from '../_shared'
import { completeReferral } from '../_kv'
import { sendBotMessage, escapeHtml } from '../_bot'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return corsPreflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const initData = req.headers.get('X-Telegram-Init-Data')
  const verified = await verifyInitData(initData)

  if (!verified) {
    return json({ error: 'invalid_init_data' }, 401)
  }

  try {
    const inviterId = await completeReferral(verified.id)
    if (!inviterId) {
      return json({ ok: true, confirmed: false })
    }

    // Приглашение подтверждено — шлём уведомление пригласителю (best effort)
    const name = verified.firstName ? escapeHtml(verified.firstName) : 'кто-то'
    sendBotMessage(inviterId, {
      text: `🎉 <b>${name}</b> присоединился по твоему приглашению!\n\nСпасибо что делишься Сохранёнками 🙏`,
      silent: true,
    }).catch(() => {})

    return json({ ok: true, confirmed: true })
  } catch (e) {
    return json({ error: 'server_error', message: (e as Error).message }, 500)
  }
}
