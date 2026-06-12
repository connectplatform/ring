/** Survives WayForPay redirect — show referral toast on checkout processing page. */
export const REFERRAL_CHECKOUT_FLASH_KEY = 'ring_checkout_referral_flash'

export type ReferralCheckoutFlash = {
  referralCode?: string
  at: number
}

export function stashReferralCheckoutFlash(payload: { referralCode?: string }): void {
  if (typeof sessionStorage === 'undefined') return
  const flash: ReferralCheckoutFlash = {
    referralCode: payload.referralCode,
    at: Date.now(),
  }
  sessionStorage.setItem(REFERRAL_CHECKOUT_FLASH_KEY, JSON.stringify(flash))
}

/** Read once and clear (max age 30 minutes). */
export function consumeReferralCheckoutFlash(): ReferralCheckoutFlash | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(REFERRAL_CHECKOUT_FLASH_KEY)
  if (!raw) return null
  sessionStorage.removeItem(REFERRAL_CHECKOUT_FLASH_KEY)
  try {
    const parsed = JSON.parse(raw) as ReferralCheckoutFlash
    if (!parsed?.at || Date.now() - parsed.at > 30 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}
