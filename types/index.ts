import type { AuthUser, UserRole } from '@/features/auth/types'
import type { Entity, EntityType } from '@/features/entities/types'
import type { Opportunity, OpportunityType, OpportunityVisibility, OpportunityFormData, Attachment } from '@/features/opportunities/types'
import type { NewsArticle, NewsCategory, NewsVisibility, NewsStatus, NewsFormData, NewsCategoryInfo } from '@/features/news/types'

// Re-export types from features for convenience
export type { AuthUser, UserRole } from '@/features/auth/types';
export type { chat } from '@/features/chat/types';
export type { Entity, EntityType } from '@/features/entities/types';
export type { Opportunity, OpportunityType, OpportunityVisibility, OpportunityFormData, Attachment } from '@/features/opportunities/types';
export type { NewsArticle, NewsCategory, NewsVisibility, NewsStatus, NewsFormData, NewsCategoryInfo } from '@/features/news/types';

