/**
 * Shared vitals gate for passwordless first entry (email link + crypto-wallet/wagmi).
 */
export type VitalsAuthProvider =
  | 'crypto-wallet'
  | 'email-otp'
  | 'email-magic'
  | string
  | undefined
  | null

export type VitalsUserSnapshot = {
  name?: string | null
  email?: string | null
  image?: string | null
  photoURL?: string | null
}

/** True when display name is missing or looks like an email local-part placeholder. */
export function isMissingDisplayName(
  name: string | null | undefined,
  email?: string | null,
): boolean {
  const trimmed = (name || '').trim()
  if (!trimmed) return true
  if (email) {
    const local = email.split('@')[0]?.trim().toLowerCase()
    if (local && trimmed.toLowerCase() === local) return true
  }
  if (trimmed.includes('@')) return true
  return false
}

/**
 * Whether the user still needs /login/onboarding for provider-specific vitals.
 * Avatar is encouraged in UI but does not block completion in v1.
 */
export function userNeedsVitalsOnboarding(
  user: VitalsUserSnapshot | null | undefined,
  provider: VitalsAuthProvider,
): boolean {
  if (!user) return false
  const email = user.email?.trim() || ''
  const nameMissing = isMissingDisplayName(user.name, email || null)

  if (provider === 'crypto-wallet') {
    return !email || nameMissing
  }

  if (provider === 'email-otp' || provider === 'email-magic') {
    return nameMissing
  }

  // Telegram OIDC usually provides name; gate if missing so vitals form can collect it.
  if (provider === 'telegram') {
    return nameMissing
  }

  // Google / Apple: OAuth often supplies name + avatar; still gate when name is missing.
  if (
    provider === 'google' ||
    provider === 'google-one-tap' ||
    provider === 'apple'
  ) {
    return nameMissing
  }

  return false
}

/** Providers that participate in the shared vitals onboarding gate. */
export function isVitalsGatedProvider(provider: VitalsAuthProvider): boolean {
  return (
    provider === 'crypto-wallet' ||
    provider === 'email-otp' ||
    provider === 'email-magic' ||
    provider === 'telegram' ||
    provider === 'google' ||
    provider === 'google-one-tap' ||
    provider === 'apple'
  )
}
