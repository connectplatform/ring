/**
 * E.164 phone normalization for Ring GSM OTP.
 * UA-friendly: leading 0 → +380; bare 380… → +380…
 */

export function normalizeToE164(raw: string, defaultCountry = 'UA'): string | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`
  }

  if (!digits.startsWith('+')) {
    const only = digits.replace(/\D/g, '')
    if (defaultCountry === 'UA') {
      if (only.startsWith('380') && only.length === 12) {
        digits = `+${only}`
      } else if (only.startsWith('0') && only.length === 10) {
        digits = `+38${only}`
      } else if (only.length === 9) {
        digits = `+380${only}`
      } else {
        return null
      }
    } else {
      return null
    }
  }

  const e164 = `+${digits.replace(/\D/g, '')}`
  // E.164 max 15 digits after +
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null
  return e164
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a ? normalizeToE164(a) : null
  const nb = b ? normalizeToE164(b) : null
  return Boolean(na && nb && na === nb)
}
