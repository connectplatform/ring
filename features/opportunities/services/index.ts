export { getOpportunities } from './get-opportunities';
export { getConfidentialOpportunities } from './get-confidential-opportunities';
export { 
  getOpportunityById, 
  getSerializedOpportunityById, 
  getOpportunity,
  OpportunityNotFoundError,
  OpportunityAccessDeniedError 
} from './get-opportunity-by-id';
export { getOpportunitiesBySlug } from './get-opportunities-by-slug';
export { createOpportunity } from './create-opportunity';
export { deleteOpportunity } from './delete-opportunity';
export { updateOpportunity } from './update-opportunity';
