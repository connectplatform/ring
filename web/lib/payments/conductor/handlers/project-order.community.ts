/**
 * Community stub SSOT — copied to project-order.ts when empire DX is not linked.
 * Empire: ring-platform-org/web/lib/payments/conductor/handlers/project-order.ts
 */
import 'server-only'

export async function handleProjectOrderWayForPayWebhook(
  _payload: Record<string, unknown>,
): Promise<boolean> {
  return false
}

export async function handleProjectOrderStripeWebhook(
  _event: { data?: { object?: unknown } },
): Promise<boolean> {
  return false
}
