/**
 * Virtual-email SSOT for phone-only Auth.js accounts.
 * Format: `{e164Digits}@{domain}` — digits only, no `+`.
 * Domain SSOT: clone contact email host (clone.contactEmail / contact.email),
 * optional override via ring-config.auth.virtualEmailDomain.
 * Never send Ring Mailer to these addresses; never show them as “your email” in profile.
 */
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { normalizeToE164 } from '@/lib/phone/e164'

export type VirtualEmailUserLike = {
  email?: string | null
  emailKind?: string | null
  isVirtualEmail?: boolean | null
}

/** Extract hostname from an email address (contact@greenfood.live → greenfood.live). */
export function domainFromEmail(email: string | null | undefined): string | null {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized.includes('@')) return null
  const domain = normalized.split('@').pop()?.replace(/^@/, '').replace(/\.+$/, '') || ''
  if (!domain || !domain.includes('.')) return null
  return domain
}

/**
 * Virtual mailbox domain for phone-only accounts.
 * 1. Optional override: `auth.virtualEmailDomain`
 * 2. SSOT: domain of `clone.contactEmail` or `contact.email`
 * Never derives from platform hostname (no app./www. strip hack).
 */
export function getVirtualEmailDomain(): string {
  const config = getSystemConfigSnapshot()
  const configured = config.auth?.virtualEmailDomain
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().toLowerCase().replace(/^@/, '')
  }

  const fromContact =
    domainFromEmail(config.clone?.contactEmail) || domainFromEmail(config.contact?.email)
  if (fromContact) return fromContact

  throw new Error(
    'virtual-email domain unresolved: set clone.contactEmail (or contact.email), or auth.virtualEmailDomain',
  )
}

/** E.164 → digits-only local part (no leading +). */
export function e164ToVirtualLocal(e164: string): string | null {
  const normalized = normalizeToE164(e164)
  if (!normalized) return null
  const digits = normalized.replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  return digits
}

/** Build `{digits}@{domain}` for a phone-only Auth.js user. */
export function toVirtualEmail(e164: string): string | null {
  const local = e164ToVirtualLocal(e164)
  if (!local) return null
  return `${local}@${getVirtualEmailDomain()}`
}

/** Local-part of a virtual email, or null if not virtual-shaped. */
export function stripVirtualLocal(email: string | null | undefined): string | null {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized.includes('@')) return null
  const [local, domain] = normalized.split('@')
  if (!local || !domain) return null
  if (!/^\d{8,15}$/.test(local)) return null
  const expected = getVirtualEmailDomain()
  if (domain !== expected) return null
  return local
}

/**
 * Detect virtual phone mailbox.
 * True if flag / emailKind, or digits-only local @ configured virtual domain.
 * Digits-only local-part is treated as virtual even if domain SSOT is temporarily unresolved.
 */
export function isVirtualEmail(
  emailOrUser: string | null | undefined | VirtualEmailUserLike,
): boolean {
  if (emailOrUser == null) return false
  if (typeof emailOrUser === 'object') {
    if (emailOrUser.isVirtualEmail === true) return true
    if (emailOrUser.emailKind === 'virtual_phone') return true
    return isVirtualEmail(emailOrUser.email)
  }
  const normalized = emailOrUser.trim().toLowerCase()
  if (!normalized.includes('@')) return false
  const [local] = normalized.split('@')
  if (!/^\d{8,15}$/.test(local || '')) return false
  try {
    return stripVirtualLocal(normalized) !== null
  } catch {
    // Domain SSOT missing — still treat digits-only local as virtual for UI safety
    return true
  }
}

/** Display-safe email: null when virtual so UI never shows synthetic addresses. */
export function displayEmailOrNull(
  emailOrUser: string | null | undefined | VirtualEmailUserLike,
): string | null {
  if (emailOrUser == null) return null
  if (typeof emailOrUser === 'object') {
    if (isVirtualEmail(emailOrUser)) return null
    const email = (emailOrUser.email ?? '').trim()
    return email || null
  }
  if (isVirtualEmail(emailOrUser)) return null
  const email = emailOrUser.trim()
  return email || null
}
