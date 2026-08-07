import 'server-only'

import {
  hasConfidentialAccess,
  hasRoleAtLeast,
  UserRolesArray,
} from '@/features/auth/user-role'
import { isNativeTokenOnrampEnabled } from '@/lib/ring-config-chain'
import type { CreateCheckoutResult } from '@/lib/payments/conductor/types'

/**
 * Gate BuyNativeViaCard (purpose native_token_onramp).
 * Requires isNativeTokenOnrampEnabled() and confidential / admin / superadmin.
 */
export function assertNativeTokenOnrampAllowed(
  role: unknown
): CreateCheckoutResult | null {
  if (!isNativeTokenOnrampEnabled()) {
    return {
      success: false,
      error:
        'Native token card onramp is disabled (set CONFIDENTIAL_TOKEN_ONRAMP=true or tokenDesk.nativeTokenOnramp)',
      code: 'ONRAMP_DISABLED',
    }
  }
  if (!hasConfidentialAccess(role as string)) {
    return {
      success: false,
      error: 'Native token card onramp requires confidential role or higher',
      code: 'ONRAMP_FORBIDDEN',
    }
  }
  return null
}

/** Token Desk (credit→native) — subscriber+ (excludes visitor). */
export function assertTokenDeskSubscriberAccess(role: unknown): void {
  if (!hasRoleAtLeast(role as string, UserRolesArray.subscriber)) {
    throw new Error('Token desk requires subscriber role or higher')
  }
}

export function canUseTokenDesk(role: unknown): boolean {
  return hasRoleAtLeast(role as string, UserRolesArray.subscriber)
}

export function canUseNativeTokenOnramp(role: unknown): boolean {
  return isNativeTokenOnrampEnabled() && hasConfidentialAccess(role as string)
}
