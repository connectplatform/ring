/**
 * NotificationChannel.PUSH dual-dispatch — per-user device-class fan-out.
 *
 * Chrome / FCM: `getToken` occupies PushManager for SW scope `/`. RFC subscribe
 * skips when a subscription already exists, so `push_subscriptions` stays empty
 * for that device. `web-push` then returns attempted=0 (no-op), not a second
 * Chrome delivery.
 *
 * Safari / RFC-only (macOS tab or iOS Home Screen PWA): no `fcm_tokens` row;
 * RFC rows exist; Admin send is the no-op.
 *
 * Same user, two devices (Chrome laptop + Safari phone): both tables have rows;
 * both sends are required. Do not skip RFC globally just because FCM is configured.
 */

export type PushStackResult = {
  attempted: number
  sent: number
  failed: number
}

export const EMPTY_PUSH_STACK: PushStackResult = {
  attempted: 0,
  sent: 0,
  failed: 0,
}

export type DualPushOutcome = {
  fcm: PushStackResult
  rfc: PushStackResult
  attempted: number
  sent: number
  /** No fcm_tokens and no push_subscriptions — nothing to deliver. */
  noDevices: boolean
  /** At least one push service accepted a message. */
  delivered: boolean
  /** Had endpoints but every send failed. */
  sendFailed: boolean
}

export type DualPushDeliveryStatus = 'delivered' | 'failed' | 'noop'

export function settleToPushStack(
  result: PromiseSettledResult<PushStackResult>,
): PushStackResult {
  if (result.status === 'fulfilled') {
    return result.value
  }
  return { attempted: 0, sent: 0, failed: 1 }
}

export function summarizeDualPush(
  fcm: PushStackResult,
  rfc: PushStackResult,
): DualPushOutcome {
  const attempted = fcm.attempted + rfc.attempted
  const sent = fcm.sent + rfc.sent
  return {
    fcm,
    rfc,
    attempted,
    sent,
    noDevices: attempted === 0,
    delivered: sent > 0,
    sendFailed: attempted > 0 && sent === 0,
  }
}

export function dualPushDeliveryStatus(
  outcome: DualPushOutcome,
): DualPushDeliveryStatus {
  if (outcome.delivered) return 'delivered'
  if (outcome.sendFailed) return 'failed'
  return 'noop'
}
