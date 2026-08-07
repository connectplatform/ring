import type { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import type { Opportunity as MatcherOpportunity } from '@/lib/ai/types'
import { toIsoDate } from '@/lib/serialization/to-iso-date'

/**
 * Converts an Opportunity object into a SerializedOpportunity, ensuring all date fields are
 * normalized to ISO string format for consistent use by the AI matcher.
 * - Copies all properties from the input opportunity.
 * - Converts dateCreated, dateUpdated, and expirationDate to ISO strings.
 * - Converts applicationDeadline to an ISO string if defined; otherwise, leaves it undefined.
 */
export function serializeOpportunityForMatching(opportunity: Opportunity): MatcherOpportunity {
  // TODO: If possible, consider using zod or a schema validator for runtime assurance of field formats.
  // TODO: If all dates in Opportunity are guaranteed to be serializable, consider mapping date fields dynamically for extensibility.

  const serialized: SerializedOpportunity = {
    ...opportunity, // Spread base properties from Opportunity
    dateCreated: toIsoDate(opportunity.dateCreated), // Normalize dateCreated to ISO string
    dateUpdated: toIsoDate(opportunity.dateUpdated), // Normalize dateUpdated to ISO string
    expirationDate: toIsoDate(opportunity.expirationDate), // Normalize expirationDate to ISO string
    applicationDeadline: opportunity.applicationDeadline
      ? toIsoDate(opportunity.applicationDeadline) // Conditionally normalize if present
      : undefined, // Leave undefined if not present
  }
  return serialized
}
