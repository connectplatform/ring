import { hasConfidentialAccess, hasRoleAtLeast, UserRolesArray } from '@/features/auth/user-role'
import { isNativeTokenOnrampEnabled } from '@/lib/ring-config-client'

export function canUseNativeTokenOnrampClient(role: unknown): boolean {
  return isNativeTokenOnrampEnabled() && hasConfidentialAccess(role as string)
}

export function canUseTokenDeskClient(role: unknown): boolean {
  return hasRoleAtLeast(role as string, UserRolesArray.subscriber)
}
