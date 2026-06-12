/**
 * Opportunity lifecycle statuses for My Opportunities views.
 *
 * Ring rules:
 * - Submit → `pending` (awaiting review)
 * - Save / inactive / deactivated → `draft` bucket (`draft`, `closed`, `expired`)
 * - Published live listings → `active`
 * - User-archived → `archived` (only deletable state for owners)
 * - `all` view excludes `archived`
 */

export type OpportunityLifecycleStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'closed'
  | 'expired'
  | 'archived'

export type MyOpportunitiesView = 'all' | 'drafts' | 'pending' | 'active' | 'archived'

const DRAFT_BUCKET = new Set<OpportunityLifecycleStatus>(['draft', 'closed', 'expired'])

export function normalizeOpportunityStatus(status?: string): OpportunityLifecycleStatus {
  if (!status) return 'draft'
  if (
    status === 'draft' ||
    status === 'pending' ||
    status === 'active' ||
    status === 'archived' ||
    status === 'closed' ||
    status === 'expired'
  ) {
    return status
  }
  return 'draft'
}

export function isDraftBucket(status?: string): boolean {
  return DRAFT_BUCKET.has(normalizeOpportunityStatus(status))
}

export function isArchivedStatus(status?: string): boolean {
  return normalizeOpportunityStatus(status) === 'archived'
}

export function matchesMyOpportunitiesView(status: string | undefined, view: MyOpportunitiesView): boolean {
  const normalized = normalizeOpportunityStatus(status)

  switch (view) {
    case 'archived':
      return normalized === 'archived'
    case 'all':
      return normalized !== 'archived'
    case 'drafts':
      return isDraftBucket(status)
    case 'pending':
      return normalized === 'pending'
    case 'active':
      return normalized === 'active'
    default:
      return false
  }
}

export function canOwnerDeleteOpportunity(status: string | undefined): boolean {
  return isArchivedStatus(status)
}

export interface MyOpportunitiesCounts {
  all: number
  drafts: number
  pending: number
  active: number
  archived: number
}

export function computeMyOpportunitiesCounts(
  opportunities: Array<{ status?: string }>,
): MyOpportunitiesCounts {
  const counts: MyOpportunitiesCounts = {
    all: 0,
    drafts: 0,
    pending: 0,
    active: 0,
    archived: 0,
  }

  for (const opp of opportunities) {
    const status = opp.status
    if (matchesMyOpportunitiesView(status, 'archived')) {
      counts.archived++
      continue
    }
    if (matchesMyOpportunitiesView(status, 'all')) counts.all++
    if (matchesMyOpportunitiesView(status, 'drafts')) counts.drafts++
    if (matchesMyOpportunitiesView(status, 'pending')) counts.pending++
    if (matchesMyOpportunitiesView(status, 'active')) counts.active++
  }

  return counts
}

export function parseMyOpportunitiesView(raw?: string): MyOpportunitiesView {
  if (raw === 'drafts' || raw === 'pending' || raw === 'active' || raw === 'archived') {
    return raw
  }
  if (raw === 'created' || raw === 'posted') return 'active'
  if (raw === 'saved') return 'all'
  return 'all'
}
