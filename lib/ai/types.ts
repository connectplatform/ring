/**
 * AI Matching System Types and Interfaces
 *
 * Comprehensive type definitions for the LLM-powered opportunity matching system.
 * Includes types for opportunities, users, matches, and LLM interactions.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

// Re-export opportunity types from main types file
export type { SerializedOpportunity as Opportunity } from '@/features/opportunities/types';

// Auto-fill result interface
export interface AutoFillResult {
  enrichedOpportunity: EnrichedOpportunity;
  confidence: number;
  processingTime: number;
  suggestions: {
    field: string;
    value: any;
    confidence: number;
    reasoning: string;
  }[];
}

// Base opportunity input for matching
export interface OpportunityInput {
  id?: string;
  type: string;
  title: string;
  description: string;
  tags?: string[];
  category?: string;
  location?: string;
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  requiredSkills?: string[];
  experienceLevel?: string;
  urgency?: string;
  workType?: string;
  industryCategory?: string;
  companySize?: string;
  estimatedDuration?: string;
}

// Enriched opportunity with AI-generated fields
export interface EnrichedOpportunity extends OpportunityInput {
  suggestedTags: string[];
  estimatedBudget?: {
    min: number;
    max: number;
    currency: string;
    confidence: number;
  };
  requiredSkills: string[];
  industryCategory: string;
  locationPreference: 'remote' | 'hybrid' | 'onsite';
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  urgency: 'high' | 'medium' | 'low';
  estimatedDuration?: string;
  companySize?: 'startup' | 'scaleup' | 'enterprise';
  workType: 'contract' | 'full-time' | 'part-time' | 'freelance';
  enrichmentMetadata: {
    confidence: number;
    autoFilledFields: string[];
    processingTime: number;
  };
}

// User profile for matching
export interface UserProfile {
  id: string;
  name?: string;
  skills: string[];
  experience: string[];
  location?: string;
  availability: string;
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  industry: string[];
  careerGoals?: string[];
  preferredWorkTypes?: string[];
  experienceLevel?: string;
  languages?: string[];
}

// Match result with detailed scoring
export interface UserMatch {
  userId: string;
  userName?: string;
  overallScore: number; // 0-100
  matchFactors: MatchFactors;
  explanation: string; // 160-char personalized explanation
  confidence: number; // 0-1
}

// Detailed matching factors
export interface MatchFactors {
  skillMatch: number; // 0-100
  experienceMatch: number; // 0-100
  industryMatch: number; // 0-100
  locationMatch: number; // 0-100
  budgetMatch: number; // 0-100
  availabilityMatch: number; // 0-100
  careerMatch: number; // 0-100
  cultureMatch: number; // 0-100
}

// LLM prompt templates
export interface LLMPrompts {
  autoFill: string;
  userMatching: string;
  matchExplanation: string;
}

// Auto-fill analysis result
export interface AutoFillAnalysis {
  suggestedTags: string[];
  estimatedBudget?: {
    min: number;
    max: number;
    currency: string;
    reasoning: string;
  };
  requiredSkills: string[];
  industryCategory: string;
  locationPreference: 'remote' | 'hybrid' | 'onsite';
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  urgency: 'high' | 'medium' | 'low';
  estimatedDuration?: string;
  companySize?: 'startup' | 'scaleup' | 'enterprise';
  workType: 'contract' | 'full-time' | 'part-time' | 'freelance';
  confidence: number;
  reasoning: string;
}

// User matching analysis result
export interface UserMatchingAnalysis {
  matches: Array<{
    userId: string;
    score: number;
    factors: MatchFactors;
    explanation: string;
    confidence: number;
  }>;
  totalCandidates: number;
  processingTime: number;
}

// LLM configuration for different use cases
export interface LLMConfig {
  autoFill: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  userMatching: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  explanation: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

// Caching interfaces for performance optimization
export interface MatchCacheEntry {
  opportunityId: string;
  userId: string;
  match: UserMatch;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface AutoFillCacheEntry {
  opportunityInput: string; // Hash of input fields
  analysis: AutoFillAnalysis;
  timestamp: number;
  ttl: number;
}

// Error types for AI operations
export class AIOperationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIOperationError';
  }
}

export class LLMServiceError extends Error {
  constructor(
    message: string,
    public provider: string,
    public model: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

// Notification types for matches
export interface OpportunityMatchNotification {
  type: 'OPPORTUNITY_MATCHED_AI';
  userId: string;
  opportunityId: string;
  matchScore: number;
  matchReason: string;
  opportunity: {
    title: string;
    type: string;
    category?: string;
    location?: string;
  };
}

// User preferences for matching
export interface UserMatchingPreferences {
  userId: string;
  enabled: boolean;
  minMatchScore: number; // Minimum score to receive notifications (default: 70)
  maxNotificationsPerDay: number; // Default: 5
  preferredCategories?: string[];
  preferredLocations?: string[];
  preferredWorkTypes?: string[];
  skillBoost: string[]; // Skills to prioritize in matching
  industryBoost: string[]; // Industries to prioritize
}

// Analytics and metrics
export interface MatcherAnalytics {
  totalMatches: number;
  averageMatchScore: number;
  matchDistribution: { [score: number]: number };
  autoFillSuccessRate: number;
  llmUsage: {
    totalTokens: number;
    totalRequests: number;
    averageResponseTime: number;
  };
  userEngagement: {
    notificationClickRate: number;
    matchAcceptanceRate: number;
  };
}

// Batch processing interfaces
export interface BatchMatchingRequest {
  opportunity: OpportunityInput;
  userProfiles: UserProfile[];
  options?: {
    maxMatches?: number;
    minScore?: number;
    includeExplanations?: boolean;
  };
}

export interface BatchMatchingResponse {
  matches: UserMatch[];
  processingTime: number;
  cachedMatches: number;
  freshMatches: number;
}
