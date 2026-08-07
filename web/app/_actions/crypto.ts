'use server'

/**
 * Crypto wallet auth helpers (nonce flow lives under /api/auth/crypto).
 * Vitals onboarding for wallet + email is SSOT at @/app/_actions/vitals-onboarding.
 */

export {
  completeVitalsOnboarding,
  type VitalsOnboardingFormState,
} from '@/app/_actions/vitals-onboarding'
