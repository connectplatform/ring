import { describe, expect, it } from '@jest/globals'
import { applyOpportunityListUpdate } from '@/hooks/use-realtime-opportunities'
import type { SerializedOpportunity } from '@/features/opportunities/types'

function row(overrides: Partial<SerializedOpportunity> = {}): SerializedOpportunity {
  return {
    id: 'opp-1',
    type: 'offer',
    title: 'Original',
    isConfidential: false,
    briefDescription: 'Brief',
    createdBy: 'owner-1',
    organizationId: 'entity-1',
    dateCreated: new Date().toISOString(),
    dateUpdated: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    status: 'active',
    category: 'tech',
    tags: [],
    location: 'CK',
    requiredSkills: [],
    requiredDocuments: [],
    attachments: [],
    visibility: 'public',
    contactInfo: { linkedEntity: 'entity-1', contactAccount: 'owner-1' },
    applicantCount: 1,
    creator: { id: 'owner-1', name: 'Owner' },
    viewer: { liked: true, saved: false, hidden: false },
    ...overrides,
  }
}

describe('applyOpportunityListUpdate', () => {
  it('keeps local viewer when broadcast includes a viewer', () => {
    const prev = [row()]
    const next = applyOpportunityListUpdate(prev, {
      type: 'updated',
      opportunityId: 'opp-1',
      data: {
        title: 'Patched',
        viewer: { liked: false, saved: true, hidden: true },
      },
    })
    expect(next[0].title).toBe('Patched')
    expect(next[0].viewer).toEqual({ liked: true, saved: false, hidden: false })
  })

  it('does not clobber type from a booking snippet', () => {
    const prev = [row({ type: 'scheduled_services', applicantCount: 2 })]
    const next = applyOpportunityListUpdate(prev, {
      type: 'updated',
      opportunityId: 'opp-1',
      data: { applicantCount: 3 },
    })
    expect(next[0].type).toBe('scheduled_services')
    expect(next[0].applicantCount).toBe(3)
  })

  it('keeps creator unless the patch has a real creator object', () => {
    const prev = [row()]
    const withoutCreator = applyOpportunityListUpdate(prev, {
      type: 'updated',
      opportunityId: 'opp-1',
      data: { title: 'No creator' },
    })
    expect(withoutCreator[0].creator).toEqual({ id: 'owner-1', name: 'Owner' })

    const withCreator = applyOpportunityListUpdate(prev, {
      type: 'updated',
      opportunityId: 'opp-1',
      data: { creator: { id: 'owner-1', name: 'Renamed' } },
    })
    expect(withCreator[0].creator).toEqual({ id: 'owner-1', name: 'Renamed' })
  })
})
