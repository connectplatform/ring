/**
 * L1 stub — packs overwrite this file to declare extra opportunity types.
 * L1 hardcoded types stay in the add page, server action, and permissions.
 */
import type { OpportunityVisibility } from '@/features/opportunities/types'

export type OpportunityTypePolicy = {
  posterKind: 'individual' | 'entity'
  requiresEntity: boolean
  minRole: 'subscriber' | 'member' | 'admin'
  memberOnly?: boolean
  defaultVisibility?: OpportunityVisibility
  defaultStatus?: 'active' | 'pending'
  buildMetadata?: (formData: FormData) => Record<string, unknown>
}

export const OPPORTUNITY_TYPE_POLICIES: Record<string, OpportunityTypePolicy> = {}

export function getOpportunityTypePolicy(type: string | undefined | null): OpportunityTypePolicy | undefined {
  if (!type) return undefined
  return OPPORTUNITY_TYPE_POLICIES[type]
}

export function policyTypeIds(): string[] {
  return Object.keys(OPPORTUNITY_TYPE_POLICIES)
}
