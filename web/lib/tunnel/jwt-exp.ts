/** Client-safe read of a JWT exp claim. Does not verify the signature. */

export function jwtExpiresAtMs(token: string): number | null {
  const part = token.split('.')[1]
  if (!part || typeof atob !== 'function') return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function isJwtExpired(token: string, skewMs = 60_000): boolean {
  const exp = jwtExpiresAtMs(token)
  if (!exp) return false
  return Date.now() + skewMs >= exp
}
