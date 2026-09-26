import { describe, expect, it } from '@jest/globals'
import { parseOpportunityListQuery } from '@/features/opportunities/lib/opportunity-search-params'
import {
  parseMyOpportunitiesView,
  isMyOpportunitiesInteractionView,
} from '@/features/opportunities/lib/lifecycle-status'

describe('opportunity search params', () => {
  it('parses search GET without q', () => {
    const parsed = parseOpportunityListQuery(new URLSearchParams('types=offer&limit=20'))
    expect(parsed.query).toBeUndefined()
    expect(parsed.types).toEqual(['offer'])
    expect(parsed.limit).toBe(20)
  })
})

describe('my opportunities views', () => {
  it('keeps saved and applied instead of mapping saved to all', () => {
    expect(parseMyOpportunitiesView('saved')).toBe('saved')
    expect(parseMyOpportunitiesView('applied')).toBe('applied')
    expect(isMyOpportunitiesInteractionView('saved')).toBe(true)
    expect(isMyOpportunitiesInteractionView('all')).toBe(false)
  })
})
