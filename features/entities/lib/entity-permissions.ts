import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRole,
  UserRole,
} from '@/features/auth/user-role'
import type { EntityVisibility } from '@/features/entities/lib/entity-visibility-filter'
import { getAllowedEntityVisibilityValues } from '@/features/entities/lib/entity-visibility-filter'

export interface EntityCreateOptions {
  isConfidential?: boolean
}

export interface EntityVisibilityPatch {
  visibility?: EntityVisibility
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

/** Whether a role may assign the given visibility / confidentiality on PATCH. */
export function canSetEntityVisibility(
  role: string | null | undefined,
  nextVisibility: EntityVisibility | undefined,
  options: { isConfidential?: boolean } = {},
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false

  const wantsConfidential =
    options.isConfidential === true || nextVisibility === 'confidential'

  if (wantsConfidential) {
    return hasConfidentialAccess(parsed)
  }

  if (!nextVisibility) {
    return true
  }

  const allowed = getAllowedEntityVisibilityValues(parsed)
  if (!allowed) {
    return true
  }

  return allowed.includes(nextVisibility)
}

/** Fail-closed guard for visibility fields on entity updates. */
export function assertEntityVisibilityPatch(
  role: string | null | undefined,
  patch: EntityVisibilityPatch,
): void {
  const { visibility, isConfidential } = patch
  if (visibility === undefined && isConfidential === undefined) {
    return
  }

  if (!canSetEntityVisibility(role, visibility, { isConfidential })) {
    throw new Error('Access denied. Your role cannot set this visibility level.')
  }
}
