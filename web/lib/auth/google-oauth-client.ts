/**
 * Google OAuth Web client ID — one Google Cloud OAuth client for Auth.js + GIS.
 *
 * - AUTH_GOOGLE_ID — server-only (Auth.js GoogleProvider, ID token verification)
 * - NEXT_PUBLIC_AUTH_GOOGLE_ID — browser GIS One Tap (same .apps.googleusercontent.com value)
 *
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is a legacy build/Docker alias only; do not add a third
 * distinct ID. Set AUTH_GOOGLE_ID and NEXT_PUBLIC_AUTH_GOOGLE_ID to the same client ID.
 */

export function getGoogleOAuthClientId(): string | undefined {
  return (
    process.env.AUTH_GOOGLE_ID?.trim() ||
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    undefined
  )
}

/** Audiences for `google-auth-library` `verifyIdToken` (GIS tokens use the public client id). */
export function getGoogleIdTokenAudiences(): string | string[] {
  const audiences = Array.from(
    new Set(
      [process.env.AUTH_GOOGLE_ID, process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID]
        .map((v) => v?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  )
  if (audiences.length === 0) {
    const legacy = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
    return legacy ?? []
  }
  return audiences.length === 1 ? audiences[0] : audiences
}
