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
  /** Optional per-type lean-form overrides (pack verticals). Defaults keep the lean policy form. */
  formOverrides?: Partial<{
    showBudget: boolean
    showSkills: boolean
    showDeadline: boolean
    showPriority: boolean
    showMaxApplicants: boolean
    showApplicationDeadline: boolean
  }>
}

export const OPPORTUNITY_TYPE_POLICIES: Record<string, OpportunityTypePolicy> = {}

/**
 * Public filter chips. Empty keeps the Layer1 technology chips.
 * Packs overwrite this file and set the vertical list.
 */
export const OPPORTUNITY_FILTER_TYPE_IDS: readonly string[] = []

/**
 * Opportunity type → path (no locale prefix). Empty on Layer1.
 * A list whose every type is in this map leaves /opportunities.
 */
export const OPPORTUNITY_CATALOG_REDIRECTS: Record<string, string> = {}

export function getOpportunityTypePolicy(type: string | undefined | null): OpportunityTypePolicy | undefined {
  if (!type) return undefined
  return OPPORTUNITY_TYPE_POLICIES[type]
}

export function policyTypeIds(): string[] {
  return Object.keys(OPPORTUNITY_TYPE_POLICIES)
}

/** One shared shelf, or the marketplace hub when the types point at different shelves. */
export function catalogRedirectForTypes(types: string[] | undefined): string | null {
  if (!types || types.length === 0) return null
  const targets = new Set<string>()
  for (const type of types) {
    const path = OPPORTUNITY_CATALOG_REDIRECTS[type]
    if (!path) return null
    targets.add(path)
  }
  if (targets.size === 1) return [...targets][0]
  return '/marketplace'
}
