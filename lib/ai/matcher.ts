/**
 * LLM-Powered Opportunity Matcher
 *
 * Replaces the baseline NeuralMatcher with intelligent LLM-driven matching.
 * Analyzes opportunities and finds relevant users with detailed scoring and explanations.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

import { cache } from 'react';
import type { Opportunity } from '@/features/opportunities/types';
import type { UserProfile, UserMatch, MatchFactors, OpportunityInput, LLMConfig } from './types';
import { createLLMClient, isLLMAvailable } from './llm-client';
import { AIOperationError, LLMServiceError } from './types';
import { logger } from '@/lib/logger';

export interface Match {
  id: string;
  score: number;
  reason?: string;
  factors?: MatchFactors;
}

/**
 * LLM-Powered Opportunity Matcher
 *
 * Provides intelligent matching between opportunities and users using LLM analysis.
 * Falls back to baseline heuristics when LLM is unavailable.
 */
export class Matcher {
  private llmClient = createLLMClient();
  private readonly maxMatches = parseInt(process.env.MAX_MATCHES_PER_OPPORTUNITY || '10');
  private readonly minMatchScore = parseFloat(process.env.MATCHING_SCORE_THRESHOLD || '0.7');

  /**
   * Cached user profiles lookup - React 19 cache() prevents duplicate API calls
   * within the same request cycle. Massive performance improvement.
   */
  getUserProfilesForMatching = cache(async (): Promise<UserProfile[]> => {
    try {
      // This would be replaced with actual database call
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      logger.warn('Failed to fetch user profiles for matching', { error });
      return [];
    }
  });

  /**
   * Cached opportunity conversion - React 19 cache() ensures same opportunity
   * is only converted once per request cycle
   */
  convertToOpportunityInputCached = cache((opportunity: Opportunity): OpportunityInput => {
    return this.convertToOpportunityInput(opportunity);
  });

  /**
   * Main matching function - analyzes opportunity and finds relevant users
   */
  /**
   * Cached LLM matching - React 19 cache() prevents duplicate LLM calls
   * for the same opportunity within the same request cycle
   */
  llmBasedMatchingCached = cache(async (
    opportunity: OpportunityInput,
    userProfiles: UserProfile[]
  ): Promise<Match[]> => {
    return this.llmBasedMatching(opportunity, userProfiles);
  });

  async match(opportunity: Opportunity): Promise<Match[]> {
    try {
      logger.info('Matcher: Starting opportunity matching', { opportunityId: opportunity.id });

      // Convert opportunity to standardized input format (cached)
      const opportunityInput = this.convertToOpportunityInputCached(opportunity);

      // Get user profiles for matching (cached - prevents duplicate API calls)
      const userProfiles = await this.getUserProfilesForMatching();

      if (!userProfiles || userProfiles.length === 0) {
        logger.warn('Matcher: No user profiles available for matching');
        return [];
      }

      // Use LLM for intelligent matching if available (cached)
      if (isLLMAvailable()) {
        return await this.llmBasedMatchingCached(opportunityInput, userProfiles);
      } else {
        logger.warn('Matcher: LLM unavailable, falling back to baseline matching');
        return await this.baselineMatching(opportunity, userProfiles);
      }

    } catch (error) {
      logger.error('Matcher: Matching failed, using fallback', { error });
      return await this.baselineMatching(opportunity, []);
    }
  }

  /**
   * LLM-powered matching with detailed analysis
   */
  private async llmBasedMatching(
    opportunity: OpportunityInput,
    userProfiles: UserProfile[]
  ): Promise<Match[]> {
    const startTime = Date.now();
    const matches: Match[] = [];

    try {
      // Process users in batches for efficiency
      const batchSize = 5;
      for (let i = 0; i < userProfiles.length; i += batchSize) {
        const batch = userProfiles.slice(i, i + batchSize);
        const batchMatches = await this.processUserBatch(opportunity, batch);
        matches.push(...batchMatches);
      }

      // Sort by score and limit results
      const sortedMatches = matches
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxMatches)
        .filter(match => match.score >= this.minMatchScore * 100);

      logger.info('Matcher: LLM matching completed', {
        totalUsers: userProfiles.length,
        matchesFound: sortedMatches.length,
        processingTime: Date.now() - startTime
      });

      return sortedMatches;

    } catch (error) {
      logger.error('Matcher: LLM matching failed', { error });
      throw new AIOperationError('LLM matching failed', 'llm_matching', error);
    }
  }

  /**
   * Process a batch of users for matching against an opportunity
   */
  private async processUserBatch(
    opportunity: OpportunityInput,
    userProfiles: UserProfile[]
  ): Promise<Match[]> {
    const matches: Match[] = [];

    // Create batch prompt for multiple users
    const batchPrompt = this.createBatchMatchingPrompt(opportunity, userProfiles);

    try {
      const response = await this.llmClient.complete(batchPrompt, {
        temperature: 0.3, // Lower temperature for consistent scoring
        maxTokens: 2000
      });

      const analysis = this.parseBatchMatchingResponse(response.content);

      // Convert analysis results to Match objects
      for (const result of analysis) {
        const userProfile = userProfiles.find(u => u.id === result.userId);
        if (userProfile && result.score >= this.minMatchScore * 100) {
          matches.push({
            id: result.userId,
            score: result.score,
            reason: result.explanation,
            factors: result.factors
          });
        }
      }

    } catch (error) {
      logger.error('Matcher: Batch processing failed', { error, batchSize: userProfiles.length });

      // Fallback to individual processing if batch fails
      for (const userProfile of userProfiles) {
        try {
          const match = await this.processIndividualUser(opportunity, userProfile);
          if (match) matches.push(match);
        } catch (individualError) {
          logger.warn('Matcher: Individual user processing failed', {
            userId: userProfile.id,
            error: individualError
          });
        }
      }
    }

    return matches;
  }

  /**
   * Process individual user matching (fallback method)
   */
  private async processIndividualUser(
    opportunity: OpportunityInput,
    userProfile: UserProfile
  ): Promise<Match | null> {
    const prompt = this.createIndividualMatchingPrompt(opportunity, userProfile);

    try {
      const response = await this.llmClient.complete(prompt, {
        temperature: 0.3,
        maxTokens: 800
      });

      const analysis = this.parseIndividualMatchingResponse(response.content);

      if (analysis.score >= this.minMatchScore * 100) {
        return {
          id: userProfile.id,
          score: analysis.score,
          reason: analysis.explanation,
          factors: analysis.factors
        };
      }

    } catch (error) {
      logger.error('Matcher: Individual matching failed', {
        userId: userProfile.id,
        error
      });
    }

    return null;
  }

  /**
   * Baseline heuristic matching (fallback when LLM unavailable)
   */
  private async baselineMatching(
    opportunity: Opportunity,
    userProfiles: UserProfile[]
  ): Promise<Match[]> {
    const matches: Match[] = [];

    for (const user of userProfiles) {
      const score = this.calculateBaselineScore(opportunity, user);
      if (score >= this.minMatchScore * 100) {
        matches.push({
          id: user.id,
          score,
          reason: `baseline-skill-match:${this.getMatchingSkills(opportunity, user).join(',')}`
        });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxMatches);
  }

  /**
   * Convert Opportunity to OpportunityInput format
   */
  private convertToOpportunityInput(opportunity: Opportunity): OpportunityInput {
    return {
      id: opportunity.id,
      type: opportunity.type,
      title: opportunity.title,
      description: opportunity.briefDescription + (opportunity.fullDescription ? '\n' + opportunity.fullDescription : ''),
      tags: opportunity.tags || [],
      category: opportunity.category,
      location: opportunity.location,
      budget: opportunity.budget,
      requiredSkills: opportunity.requiredSkills || [],
      experienceLevel: this.inferExperienceLevel(opportunity),
      urgency: this.inferUrgency(opportunity),
      workType: this.inferWorkType(opportunity)
    };
  }

  /**
   * Get user profiles for matching (non-cached version - legacy method)
   * Note: Use the cached version above for better performance
   */
  private async getUserProfilesForMatchingLegacy(): Promise<UserProfile[]> {
    // TODO: Implement actual database query to get user profiles
    // For now, return empty array to trigger baseline matching
    logger.info('Matcher: getUserProfilesForMatching - Placeholder implementation');
    return [];
  }

  /**
   * Create batch matching prompt for LLM
   */
  private createBatchMatchingPrompt(
    opportunity: OpportunityInput,
    userProfiles: UserProfile[]
  ): string {
    const isRingCustomization = opportunity.type === 'ring_customization' || 
                                opportunity.category?.includes('platform_deployment') ||
                                opportunity.category?.includes('module_development');
    
    const userSummaries = userProfiles.map(user => `
User ${user.id}:
- Skills: ${user.skills.join(', ')}
- Experience: ${user.experience.join(', ')}
- Industry: ${user.industry.join(', ')}
- Location: ${user.location || 'Not specified'}
- Availability: ${user.availability || 'Not specified'}
- Experience Level: ${user.experienceLevel || 'Not specified'}${
      isRingCustomization ? `
- Ring Platform Experience: ${user.ringExperience || 0} years
- Modules Expertise: ${user.modulesExpertise?.join(', ') || 'None'}
- Backend Expertise: ${user.backendExpertise?.join(', ') || 'None'}
- Blockchain Skills: ${user.blockchainSkills?.join(', ') || 'None'}
- AI Customization: ${user.aiCustomization ? 'Yes' : 'No'}
- White-label Deployments: ${user.whitelabelExperience || 0}` : ''
    }
    `).join('\n');

    return `Analyze this opportunity and match it against the provided user profiles. Return a JSON array with match scores and explanations.

OPPORTUNITY:
Title: ${opportunity.title}
Type: ${opportunity.type}
Description: ${opportunity.description}
Required Skills: ${opportunity.requiredSkills?.join(', ') || 'Not specified'}
Tags: ${opportunity.tags?.join(', ') || 'Not specified'}
Location: ${opportunity.location || 'Not specified'}
Budget: ${opportunity.budget ? `${opportunity.budget.currency || 'USD'} ${opportunity.budget.min || 0}-${opportunity.budget.max || 'unlimited'}` : 'Not specified'}
Experience Level: ${opportunity.experienceLevel || 'Not specified'}
Work Type: ${opportunity.workType || 'Not specified'}

USER PROFILES:
${userSummaries}

INSTRUCTIONS:
1. Analyze each user's skills, experience, and preferences against the opportunity requirements
2. Calculate match scores (0-100) based on skill alignment, experience fit, location compatibility, and budget expectations
3. Provide a 160-character explanation for each match explaining why it's a good fit
4. Focus on the top ${this.maxMatches} matches with scores >= ${this.minMatchScore * 100}

Return JSON format:
[{
  "userId": "user_id",
  "score": 85,
  "explanation": "160-char explanation of why this user matches well",
  "factors": {
    "skillMatch": 90,
    "experienceMatch": 80,
    "industryMatch": 85,
    "locationMatch": 75,
    "budgetMatch": 70,
    "availabilityMatch": 80,
    "careerMatch": 85,
    "cultureMatch": 70
  }
}, ...]`;
  }

  /**
   * Create individual matching prompt
   */
  private createIndividualMatchingPrompt(
    opportunity: OpportunityInput,
    userProfile: UserProfile
  ): string {
    const isRingCustomization = opportunity.type === 'ring_customization' || 
                                opportunity.category?.includes('platform_deployment') ||
                                opportunity.category?.includes('module_development');
    
    return `Match this user profile against the opportunity requirements.${
      isRingCustomization ? ' Pay special attention to Ring Platform expertise for this customization project.' : ''
    }

OPPORTUNITY:
Title: ${opportunity.title}
Type: ${opportunity.type}
Category: ${opportunity.category || 'Not specified'}
Description: ${opportunity.description}
Required Skills: ${opportunity.requiredSkills?.join(', ') || 'Not specified'}
Tags: ${opportunity.tags?.join(', ') || 'Not specified'}
Location: ${opportunity.location || 'Not specified'}
Budget: ${opportunity.budget ? `${opportunity.budget.currency || 'USD'} ${opportunity.budget.min || 0}-${opportunity.budget.max || 'unlimited'}` : 'Not specified'}

USER PROFILE:
Skills: ${userProfile.skills.join(', ')}
Experience: ${userProfile.experience.join(', ')}
Industry: ${userProfile.industry.join(', ')}
Location: ${userProfile.location || 'Not specified'}
Availability: ${userProfile.availability || 'Not specified'}
Experience Level: ${userProfile.experienceLevel || 'Not specified'}${
      isRingCustomization ? `
Ring Platform Experience: ${userProfile.ringExperience || 0} years
Modules Expertise: ${userProfile.modulesExpertise?.join(', ') || 'None'}
Backend Expertise: ${userProfile.backendExpertise?.join(', ') || 'None'}
Blockchain Skills: ${userProfile.blockchainSkills?.join(', ') || 'None'}
AI Customization: ${userProfile.aiCustomization ? 'Yes' : 'No'}
White-label Deployments: ${userProfile.whitelabelExperience || 0}
Languages: ${userProfile.languages?.join(', ') || 'Not specified'}` : ''
    }

Return JSON format:
{
  "score": 85,
  "explanation": "160-character explanation of the match quality and fit",
  "factors": {
    "skillMatch": 90,
    "experienceMatch": 80,
    "industryMatch": 85,
    "locationMatch": 75,
    "budgetMatch": 70,
    "availabilityMatch": 80,
    "careerMatch": 85,
    "cultureMatch": 70
  }
}`;
  }

  /**
   * Parse batch matching response from LLM
   */
  private parseBatchMatchingResponse(response: string): Array<{
    userId: string;
    score: number;
    explanation: string;
    factors: MatchFactors;
  }> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error('Matcher: Failed to parse batch matching response', { response, error });
      return [];
    }
  }

  /**
   * Parse individual matching response
   */
  private parseIndividualMatchingResponse(response: string): {
    score: number;
    explanation: string;
    factors: MatchFactors;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Matcher: Failed to parse individual matching response', { response, error });
      return {
        score: 0,
        explanation: 'Failed to analyze match',
        factors: {
          skillMatch: 0,
          experienceMatch: 0,
          industryMatch: 0,
          locationMatch: 0,
          budgetMatch: 0,
          availabilityMatch: 0,
          careerMatch: 0,
          cultureMatch: 0
        }
      };
    }
  }

  /**
   * Calculate baseline matching score (fallback method)
   */
  private calculateBaselineScore(opportunity: Opportunity, user: UserProfile): number {
    let score = 0;

    // Skill matching (40% weight)
    const matchingSkills = this.getMatchingSkills(opportunity, user);
    const skillScore = matchingSkills.length / Math.max(opportunity.requiredSkills?.length || 1, 1) * 100;
    score += skillScore * 0.4;

    // Tag matching (30% weight)
    const matchingTags = this.getMatchingTags(opportunity, user);
    const tagScore = matchingTags.length / Math.max(opportunity.tags?.length || 1, 1) * 100;
    score += tagScore * 0.3;

    // Location matching (20% weight)
    const locationScore = this.getLocationScore(opportunity, user);
    score += locationScore * 0.2;

    // Experience level matching (10% weight)
    const experienceScore = this.getExperienceScore(opportunity, user);
    score += experienceScore * 0.1;

    return Math.min(score, 100);
  }

  /**
   * Helper methods for baseline matching
   */
  private getMatchingSkills(opportunity: Opportunity, user: UserProfile): string[] {
    const oppSkills = opportunity.requiredSkills || [];
    return oppSkills.filter(skill =>
      user.skills.some(userSkill =>
        userSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(userSkill.toLowerCase())
      )
    );
  }

  private getMatchingTags(opportunity: Opportunity, user: UserProfile): string[] {
    const oppTags = opportunity.tags || [];
    // Simple tag matching - in real implementation would use more sophisticated matching
    return oppTags.filter(tag =>
      user.skills.some(skill => skill.toLowerCase().includes(tag.toLowerCase())) ||
      user.industry.some(industry => industry.toLowerCase().includes(tag.toLowerCase()))
    );
  }

  private getLocationScore(opportunity: Opportunity, user: UserProfile): number {
    if (!opportunity.location || !user.location) return 50; // Neutral score if location not specified

    const oppLocation = opportunity.location.toLowerCase();
    const userLocation = user.location.toLowerCase();

    if (oppLocation === userLocation) return 100;
    if (oppLocation.includes('remote') || userLocation.includes('remote')) return 90;
    if (oppLocation.includes(userLocation) || userLocation.includes(oppLocation)) return 75;

    return 25; // Different locations
  }

  private getExperienceScore(opportunity: Opportunity, user: UserProfile): number {
    // Simple experience level matching
    const oppLevel = this.inferExperienceLevel(opportunity);
    const userLevel = user.experienceLevel;

    if (!oppLevel || !userLevel) return 50;

    const levels = ['junior', 'mid', 'senior', 'lead'];
    const oppIndex = levels.indexOf(oppLevel);
    const userIndex = levels.indexOf(userLevel);

    if (oppIndex === -1 || userIndex === -1) return 50;

    const diff = Math.abs(oppIndex - userIndex);
    return Math.max(100 - diff * 25, 25);
  }

  private inferExperienceLevel(opportunity: Opportunity): string {
    const description = (opportunity.briefDescription + ' ' + (opportunity.fullDescription || '')).toLowerCase();
    if (description.includes('lead') || description.includes('senior') || description.includes('expert')) return 'senior';
    if (description.includes('mid') || description.includes('intermediate')) return 'mid';
    if (description.includes('junior') || description.includes('entry')) return 'junior';
    return 'mid'; // Default
  }

  private inferUrgency(opportunity: Opportunity): string {
    const description = (opportunity.briefDescription + ' ' + (opportunity.fullDescription || '')).toLowerCase();
    if (description.includes('urgent') || description.includes('asap') || description.includes('immediately')) return 'high';
    if (description.includes('soon') || description.includes('quick')) return 'medium';
    return 'low';
  }

  private inferWorkType(opportunity: Opportunity): string {
    const description = (opportunity.briefDescription + ' ' + (opportunity.fullDescription || '')).toLowerCase();
    if (description.includes('contract') || description.includes('freelance')) return 'contract';
    if (description.includes('part-time') || description.includes('part time')) return 'part-time';
    if (description.includes('full-time') || description.includes('full time')) return 'full-time';
    return 'full-time'; // Default
  }
}

// Export helper function for backward compatibility
export async function generateOpportunityEmbedding(opportunity: Opportunity): Promise<number[]> {
  // Placeholder - maintain compatibility with existing code
  // In the new system, embeddings are handled by the LLM client
  const tags = (opportunity.tags || []).slice(0, 16);
  return tags.map(t => (t?.length || 0) % 7);
}
