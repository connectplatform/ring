// Client-only search functions that don't depend on server-side modules
// Used by client components to avoid Next.js import restrictions

export {
  searchOpportunities,
  searchOpportunitiesByQuery,
  searchOpportunitiesByLocation,
  searchOpportunitiesByBudget,
  searchOpportunitiesByTypeAndCategory,
  advancedSearchOpportunities
} from './client-search-opportunities'

export type {
  SearchOpportunitiesParams,
  SearchOpportunitiesResult,
  SerializedOpportunity
} from './client-search-opportunities'
