/**
 * Knowledge Base Module
 * =====================
 */

export { KnowledgeBaseService, getKnowledgeBaseService, InMemoryKnowledgeRepository } from './knowledge-base';
export type { 
  KnowledgeDocument, 
  SearchResult, 
  KnowledgeCreateInput,
  KnowledgeRepository
} from './knowledge-base';
