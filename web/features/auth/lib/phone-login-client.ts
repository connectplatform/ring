/**
 * Client-safe helpers for phone login UI (no server secrets).
 * WhatsApp rail is offered only when public flag is set — secrets stay server-side.
 */

export const WHATSAPP_OPT_OUT_STORAGE_KEY = 'ring.phoneOtp.whatsappOptOut'

export function whatsAppRailAvailableClient(): boolean {
  return process.env.NEXT_PUBLIC_WHATSAPP_OTP_ENABLED === 'true'
}

export function readWhatsappOptOut(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(WHATSAPP_OPT_OUT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWhatsappOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (optOut) {
      window.localStorage.setItem(WHATSAPP_OPT_OUT_STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(WHATSAPP_OPT_OUT_STORAGE_KEY)
    }
  } catch {
    // ignore quota / private mode
  }
}
