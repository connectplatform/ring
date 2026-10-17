import {
  isPlatformAdmin,
  parseUserRolesArray,
  UserRolesArray,
} from '@/features/auth/user-role'
import type { SerializedOpportunity } from '@/features/opportunities/types'

export interface OpportunityIdentityContext {
  viewerUserId?: string
  viewerRole?: string | null
}

export function isAnonymousPosterRow(row: {
  anonymousPoster?: boolean
}): boolean {
  return row.anonymousPoster === true
}

/** True when this viewer must not see the poster's identity. */
export function shouldMaskAnonymousPoster(
  row: { anonymousPoster?: boolean; createdBy?: string },
  ctx: OpportunityIdentityContext,
): boolean {
  if (!isAnonymousPosterRow(row)) return false
  if (ctx.viewerUserId && row.createdBy && ctx.viewerUserId === row.createdBy) return false
  if (isPlatformAdmin(ctx.viewerRole)) return false
  return true
}

/**
 * Strip identity fields for anonymous-in-pool posts.
 * Owner and platform admin keep the full row.
 */
export function maskAnonymousOpportunity<T extends SerializedOpportunity>(
  row: T,
  ctx: OpportunityIdentityContext,
): T {
  if (!shouldMaskAnonymousPoster(row, ctx)) return row
  const { creator: _creator, ...rest } = row
  return {
    ...rest,
    creator: undefined,
    organizationId: '',
    createdBy: '',
    anonymousPoster: true,
    contactInfo: {
      linkedEntity: '',
      contactAccount: '',
    },
  } as T
}

/**
 * Tunnel update payload. Omits identity keys so a spread cannot blank the
 * owner's row. API reads still use maskAnonymousOpportunity (empty strings).
 */
export function toPublicDiscoverySnippet(
  row: SerializedOpportunity,
): Record<string, unknown> {
  if (!isAnonymousPosterRow(row)) {
    const { viewer: _viewer, ...rest } = row
    return rest as unknown as Record<string, unknown>
  }
  const {
    creator: _creator,
    createdBy: _createdBy,
    organizationId: _organizationId,
    contactInfo: _contactInfo,
    viewer: _viewer,
    ...rest
  } = row
  return { ...rest, anonymousPoster: true }
}

export function canSetAnonymousPoster(
  role: string | null | undefined,
  visibility: string | null | undefined,
): boolean {
  const parsed = parseUserRolesArray(role)
  if (parsed !== UserRolesArray.confidential) return false
  return visibility === 'member' || visibility === 'subscriber'
}
