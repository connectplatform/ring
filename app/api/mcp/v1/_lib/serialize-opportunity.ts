import type { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import type { Opportunity as MatcherOpportunity } from '@/lib/ai/types'
import { toIsoDate } from '@/lib/serialization/to-iso-date'

/** Normalize DB/Firestore opportunity rows for AI matcher (expects ISO date strings). */
export function serializeOpportunityForMatching(opportunity: Opportunity): MatcherOpportunity {
  const serialized: SerializedOpportunity = {
    ...opportunity,
    dateCreated: toIsoDate(opportunity.dateCreated),
    dateUpdated: toIsoDate(opportunity.dateUpdated),
    expirationDate: toIsoDate(opportunity.expirationDate),
    applicationDeadline: opportunity.applicationDeadline
      ? toIsoDate(opportunity.applicationDeadline)
      : undefined,
  }
  return serialized
}
