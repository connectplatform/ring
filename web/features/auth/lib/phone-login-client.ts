/**
 * Client-safe helpers for phone login UI (no server secrets).
 * WhatsApp rail is offered only when public flag is set — secrets stay server-side.
 */
export function whatsAppRailAvailableClient(): boolean {
  return process.env.NEXT_PUBLIC_WHATSAPP_OTP_ENABLED === 'true'
}
