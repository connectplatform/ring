/**
 * Telegram Gateway OTP client (identity rail only).
 * @see https://core.telegram.org/gateway/api
 * Token: TELEGRAM_GATEWAY_TOKEN (server-only).
 */

import { logger } from '@/lib/logger'

const GATEWAY_BASE = 'https://gatewayapi.telegram.org'

export type GatewayVerificationStatus =
  | 'code_valid'
  | 'code_invalid'
  | 'code_max_attempts_exceeded'
  | 'expired'
  | string

export interface GatewayRequestStatus {
  request_id: string
  phone_number?: string
  request_cost?: number
  is_refunded?: boolean
  remaining_balance?: number
  delivery_status?: { status?: string; updated_at?: number }
  verification_status?: { status?: GatewayVerificationStatus; updated_at?: number; code_entered?: string }
}

interface GatewayEnvelope<T> {
  ok: boolean
  result?: T
  error?: string
}

function getGatewayToken(): string | null {
  const token = process.env.TELEGRAM_GATEWAY_TOKEN?.trim()
  return token || null
}

export function isTelegramGatewayConfigured(): boolean {
  return Boolean(getGatewayToken())
}

async function gatewayCall<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = getGatewayToken()
  if (!token) {
    return { ok: false, error: 'TELEGRAM_GATEWAY_TOKEN not configured' }
  }

  try {
    const res = await fetch(`${GATEWAY_BASE}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => null)) as GatewayEnvelope<T> | null
    if (!res.ok) {
      const err = json?.error || `HTTP ${res.status}`
      logger.warn('TelegramGateway: transport failure', { method, err })
      return { ok: false, error: err }
    }
    if (!json?.ok || json.result === undefined) {
      return { ok: false, error: json?.error || 'Gateway returned ok:false' }
    }
    return { ok: true, result: json.result }
  } catch (error) {
    logger.error('TelegramGateway: request failed', { method, error })
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gateway request failed',
    }
  }
}

/** Cost-aware preflight; returns request_id for one free send. */
export async function checkSendAbility(phoneNumber: string) {
  return gatewayCall<GatewayRequestStatus>('checkSendAbility', {
    phone_number: phoneNumber,
  })
}

export async function sendVerificationMessage(opts: {
  phoneNumber: string
  requestId?: string
  codeLength?: number
  ttl?: number
  callbackUrl?: string
  senderUsername?: string
}) {
  const body: Record<string, unknown> = {
    phone_number: opts.phoneNumber,
    code_length: opts.codeLength ?? 6,
    ttl: opts.ttl ?? 120,
  }
  if (opts.requestId) body.request_id = opts.requestId
  if (opts.callbackUrl) body.callback_url = opts.callbackUrl
  if (opts.senderUsername) body.sender_username = opts.senderUsername

  return gatewayCall<GatewayRequestStatus>('sendVerificationMessage', body)
}

export async function checkVerificationStatus(opts: {
  requestId: string
  code?: string
}) {
  const body: Record<string, unknown> = {
    request_id: opts.requestId,
  }
  if (opts.code) body.code = opts.code
  return gatewayCall<GatewayRequestStatus>('checkVerificationStatus', body)
}

export async function revokeVerificationMessage(requestId: string) {
  return gatewayCall<boolean>('revokeVerificationMessage', { request_id: requestId })
}

/**
 * Preferred cost path: checkSendAbility → send with request_id.
 * On inability (no Telegram), returns fallback_needed.
 */
export async function sendPhoneOtpViaGateway(phoneNumber: string): Promise<
  | { ok: true; requestId: string; provider: 'telegram_gateway' }
  | { ok: false; error: string; fallbackNeeded?: boolean }
> {
  if (!isTelegramGatewayConfigured()) {
    return { ok: false, error: 'Telegram Gateway not configured', fallbackNeeded: true }
  }

  const ability = await checkSendAbility(phoneNumber)
  if (ability.ok === false) {
    return { ok: false, error: ability.error, fallbackNeeded: true }
  }

  const send = await sendVerificationMessage({
    phoneNumber,
    requestId: ability.result.request_id,
    codeLength: 6,
    ttl: 180,
    callbackUrl: process.env.TELEGRAM_GATEWAY_CALLBACK_URL?.trim() || undefined,
    senderUsername: process.env.TELEGRAM_GATEWAY_SENDER_USERNAME?.trim() || undefined,
  })

  if (send.ok === false) {
    return { ok: false, error: send.error, fallbackNeeded: true }
  }

  return {
    ok: true,
    requestId: send.result.request_id || ability.result.request_id,
    provider: 'telegram_gateway',
  }
}
