import type { Entity, SerializedEntity } from '@/features/entities/types'

export type EntityVerificationFilter = 'all' | 'verified' | 'unverified' | 'premium'

export type EntityVerificationLevel =
  | 'unverified'
  | 'basic'
  | 'verified'
  | 'premium'
  | 'enterprise'
  | 'partner'

export function isEntityIdentityVerified(entity: Entity | SerializedEntity): boolean {
  return (
    entity.verificationStatus === 'verified' ||
    entity.storeVerification?.identityVerified === true
  )
}

export function isEntityVerificationPending(entity: Entity | SerializedEntity): boolean {
  return (
    entity.verificationStatus === 'pending' ||
    entity.verificationStatus === 'under_review'
  )
}

export function isEntityPremiumVerified(entity: Entity | SerializedEntity): boolean {
  if (!isEntityIdentityVerified(entity)) {
    return false
  }
  const certifications = entity.certifications?.length ?? 0
  const partnerships = entity.partnerships?.length ?? 0
  return certifications >= 2 && partnerships > 0
}

export function entityMatchesVerificationFilter(
  entity: SerializedEntity,
  filter: EntityVerificationFilter,
): boolean {
  switch (filter) {
    case 'verified':
      return isEntityIdentityVerified(entity)
    case 'unverified':
      return !isEntityIdentityVerified(entity)
    case 'premium':
      return isEntityPremiumVerified(entity)
    default:
      return true
  }
}

/**
 * SSOT-aware badge level: platform verificationStatus / storeVerification first,
 * then legacy heuristics (certifications, partnerships, profile completeness).
 */
export function determineEntityVerificationLevel(
  entity: Entity | SerializedEntity,
): EntityVerificationLevel {
  if (
    entity.partnerships?.some(
      (p) => p.toLowerCase().includes('ring') || p.toLowerCase().includes('platform'),
    )
  ) {
    return 'partner'
  }

  if (isEntityIdentityVerified(entity)) {
    if (entity.employeeCount && entity.employeeCount > 500) {
      if (entity.certifications && entity.certifications.length >= 3) {
        return 'enterprise'
      }
    }
    if (isEntityPremiumVerified(entity)) {
      return 'premium'
    }
    return 'verified'
  }

  if (isEntityVerificationPending(entity)) {
    return 'basic'
  }

  if (entity.contactEmail && entity.phoneNumber && entity.website) {
    return 'basic'
  }

  return 'unverified'
}
