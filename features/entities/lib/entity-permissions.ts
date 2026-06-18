import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRole,
  UserRole,
} from '@/features/auth/user-role'

export interface EntityCreateOptions {
  isConfidential?: boolean
}

/** Server-side permission check for entity creation. */
export function canCreateEntity(
  role: string | null | undefined,
  options: EntityCreateOptions = {},
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false

  if (options.isConfidential) {
    return hasConfidentialAccess(parsed)
  }

  return (
    hasMemberPrivileges(parsed) ||
    isPlatformAdmin(parsed) ||
    parsed === UserRole.confidential
  )
}
