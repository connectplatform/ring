/**
 * Client-safe virtual-email detection (no ring-config / server imports).
 * Prefer DB flags; fall back to digits-only local-part heuristic.
 */
export type VirtualEmailClientUser = {
  email?: string | null
  emailKind?: string | null
  isVirtualEmail?: boolean | null
}

export function isVirtualEmailClient(user: VirtualEmailClientUser | string | null | undefined): boolean {
  if (user == null) return false
  if (typeof user === 'string') {
    const local = user.trim().toLowerCase().split('@')[0] || ''
    return /^\d{8,15}$/.test(local)
  }
  if (user.isVirtualEmail === true) return true
  if (user.emailKind === 'virtual_phone') return true
  return isVirtualEmailClient(user.email)
}

export function displayEmailClient(user: VirtualEmailClientUser | string | null | undefined): string | null {
  if (user == null) return null
  if (typeof user === 'string') {
    if (isVirtualEmailClient(user)) return null
    return user.trim() || null
  }
  if (isVirtualEmailClient(user)) return null
  const email = (user.email ?? '').trim()
  return email || null
}
