/**
 * Opportunity Matching Service
 *
 * Finds relevant users for opportunities and generates personalized match explanations.
 * Uses LLM-powered analysis for intelligent user-opportunity matching.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

import type { Opportunity, UserProfile, UserMatch, MatchFactors, OpportunityInput } from '@/lib/ai/types';
import { Matcher } from '@/lib/ai/matcher';
import { createLLMClient, isLLMAvailable } from '@/lib/ai/llm-client';
import { AIOperationError } from '@/lib/ai/types';
import { logger } from '@/lib/logger';

export interface MatchingResult {
  opportunityId: string;
  matches: UserMatch[];
  totalCandidates: number;
  processingTime: number;
  matchQuality: {
    averageScore: number;
    highQualityMatches: number; // Score >= 80
    mediumQualityMatches: number; // Score 60-79
    lowQualityMatches: number; // Score < 60
  };
}

/**
 * Service for matching opportunities with relevant users
 */
export class OpportunityMatchingService {
  private matcher = new Matcher();
  private llmClient = createLLMClient();

  /**
   * Find and analyze matches for an opportunity
   */
  async findMatches(opportunity: Opportunity): Promise<MatchingResult> {
    const startTime = Date.now();

    try {
      logger.info('MatchingService: Starting user matching', {
        opportunityId: opportunity.id,
        title: opportunity.title
      });

      // Use the Matcher class to find matches
      const rawMatches = await this.matcher.match(opportunity as any);

      // Get user profiles for the matches (placeholder - would come from database)
      const userProfiles = await this.getUserProfilesForMatches(rawMatches.map(m => m.id));

      // Enhance matches with detailed analysis if LLM available
      const enhancedMatches = await this.enhanceMatchesWithLLM(opportunity, rawMatches, userProfiles);

      // Calculate match quality statistics
      const matchQuality = this.calculateMatchQuality(enhancedMatches);

      const result: MatchingResult = {
        opportunityId: opportunity.id,
        matches: enhancedMatches,
        totalCandidates: userProfiles.length,
        processingTime: Date.now() - startTime,
        matchQuality
      };

      logger.info('MatchingService: Matching completed', {
        opportunityId: opportunity.id,
        matchesFound: enhancedMatches.length,
        averageScore: matchQuality.averageScore,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('MatchingService: Matching failed', { error, opportunityId: opportunity.id });
      throw new AIOperationError('User matching failed', 'user_matching', error);
    }
  }

  /**
   * Generate personalized match explanations using LLM
   */
  private async enhanceMatchesWithLLM(
    opportunity: Opportunity,
    rawMatches: Array<{ id: string; score: number; reason?: string; factors?: MatchFactors }>,
    userProfiles: UserProfile[]
  ): Promise<UserMatch[]> {
    if (!isLLMAvailable() || rawMatches.length === 0) {
      return rawMatches.map(match => ({
        userId: match.id,
        overallScore: match.score,
        matchFactors: match.factors || this.getDefaultMatchFactors(),
        explanation: match.reason || 'Basic tag-based match',
        confidence: 0.5
      }));
    }

    const enhancedMatches: UserMatch[] = [];

    // Process matches in batches to avoid overwhelming the LLM
    const batchSize = 3;
    for (let i = 0; i < rawMatches.length; i += batchSize) {
      const batch = rawMatches.slice(i, i + batchSize);
      const batchEnhanced = await this.enhanceBatchMatches(opportunity, batch, userProfiles);
      enhancedMatches.push(...batchEnhanced);
    }

    return enhancedMatches;
  }

  /**
   * Enhance a batch of matches with LLM analysis
   */
  private async enhanceBatchMatches(
    opportunity: Opportunity,
    matches: Array<{ id: string; score: number; reason?: string; factors?: MatchFactors }>,
    userProfiles: UserProfile[]
  ): Promise<UserMatch[]> {
    const enhancedMatches: UserMatch[] = [];

    for (const match of matches) {
      try {
        const userProfile = userProfiles.find(u => u.id === match.id);
        if (!userProfile) continue;

        const enhancedMatch = await this.enhanceIndividualMatch(opportunity, match, userProfile);
        enhancedMatches.push(enhancedMatch);

      } catch (error) {
        logger.warn('MatchingService: Failed to enhance individual match', {
          userId: match.id,
          error
        });

        // Fallback to basic match
        enhancedMatches.push({
          userId: match.id,
          overallScore: match.score,
          matchFactors: match.factors || this.getDefaultMatchFactors(),
          explanation: match.reason || 'Match analysis failed',
          confidence: 0.3
        });
      }
    }

    return enhancedMatches;
  }

  /**
   * Enhance individual match with LLM-generated explanation
   */
  private async enhanceIndividualMatch(
    opportunity: Opportunity,
    match: { id: string; score: number; reason?: string; factors?: MatchFactors },
    userProfile: UserProfile
  ): Promise<UserMatch> {
    const prompt = this.createMatchExplanationPrompt(opportunity, userProfile, match);

    try {
      const response = await this.llmClient.complete(prompt, {
        temperature: 0.7, // Higher temperature for creative explanations
        maxTokens: 300
      });

      const explanation = this.extractExplanationFromResponse(response.content);

      return {
        userId: match.id,
        userName: userProfile.name,
        overallScore: match.score,
        matchFactors: match.factors || this.getDefaultMatchFactors(),
        explanation: explanation || match.reason || 'LLM analysis failed',
        confidence: 0.8 // Higher confidence for LLM-enhanced matches
      };

    } catch (error) {
      logger.warn('MatchingService: LLM explanation failed, using fallback', {
        userId: match.id,
        error
      });

      return {
        userId: match.id,
        userName: userProfile.name,
        overallScore: match.score,
        matchFactors: match.factors || this.getDefaultMatchFactors(),
        explanation: match.reason || 'Intelligent match based on skills and experience',
        confidence: 0.5
      };
    }
  }

  /**
   * Create prompt for LLM to generate match explanation
   */
  private createMatchExplanationPrompt(
    opportunity: Opportunity,
    userProfile: UserProfile,
    match: { id: string; score: number; reason?: string; factors?: MatchFactors }
  ): string {
    const factors = match.factors || this.getDefaultMatchFactors();

    return `Generate a compelling 160-character explanation for why this user would be a great match for this opportunity. Focus on their strengths and how they align with the opportunity requirements.

OPPORTUNITY:
Title: ${opportunity.title}
Description: ${opportunity.briefDescription}
Required Skills: ${opportunity.requiredSkills?.join(', ') || 'Not specified'}
Tags: ${opportunity.tags?.join(', ') || 'Not specified'}
Location: ${opportunity.location || 'Not specified'}
Budget: ${opportunity.budget ? `${opportunity.budget.currency || 'USD'} ${opportunity.budget.min || 0}-${opportunity.budget.max || 'unlimited'}` : 'Not specified'}

USER PROFILE:
Name: ${userProfile.name || 'Anonymous'}
Skills: ${userProfile.skills.join(', ')}
Experience: ${userProfile.experience.join(', ')}
Industry: ${userProfile.industry.join(', ')}
Location: ${userProfile.location || 'Not specified'}
Experience Level: ${userProfile.experienceLevel || 'Not specified'}
Availability: ${userProfile.availability || 'Not specified'}

MATCH ANALYSIS:
Overall Score: ${match.score}/100
Skill Match: ${factors.skillMatch}/100
Experience Match: ${factors.experienceMatch}/100
Industry Match: ${factors.industryMatch}/100
Location Match: ${factors.locationMatch}/100

INSTRUCTIONS:
1. Write a personalized, compelling explanation (maximum 160 characters)
2. Highlight the user's most relevant strengths for this opportunity
3. Explain why they're a great fit based on skills, experience, and interests
4. Make it engaging and professional
5. Focus on value they can bring to the opportunity

Example: "Senior React developer with 5+ years building scalable web apps. Expert in modern JavaScript and team leadership. Perfect for your complex platform project!"

Return only the explanation text, no additional formatting or quotes.`;
  }

  /**
   * Extract explanation from LLM response
   */
  private extractExplanationFromResponse(response: string): string {
    // Clean up the response and ensure it's within 160 characters
    const cleaned = response.trim().replace(/^["']|["']$/g, '');
    return cleaned.length > 160 ? cleaned.substring(0, 157) + '...' : cleaned;
  }

  /**
   * Calculate match quality statistics
   */
  private calculateMatchQuality(matches: UserMatch[]): MatchingResult['matchQuality'] {
    if (matches.length === 0) {
      return {
        averageScore: 0,
        highQualityMatches: 0,
        mediumQualityMatches: 0,
        lowQualityMatches: 0
      };
    }

    const scores = matches.map(m => m.overallScore);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const highQualityMatches = matches.filter(m => m.overallScore >= 80).length;
    const mediumQualityMatches = matches.filter(m => m.overallScore >= 60 && m.overallScore < 80).length;
    const lowQualityMatches = matches.filter(m => m.overallScore < 60).length;

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      highQualityMatches,
      mediumQualityMatches,
      lowQualityMatches
    };
  }

  /**
   * Get user profiles for matched users (placeholder implementation)
   */
  private async getUserProfilesForMatches(userIds: string[]): Promise<UserProfile[]> {
    // TODO: Implement actual database query to get user profiles
    // For now, return mock profiles based on userIds
    logger.info('MatchingService: getUserProfilesForMatches - Placeholder implementation', { userIds });

    return userIds.map(id => ({
      id,
      name: `User ${id}`,
      skills: ['JavaScript', 'React', 'Node.js'], // Mock skills
      experience: ['Web Development', 'Full-stack Development'],
      location: 'Remote',
      availability: 'Available',
      budget: { min: 5000, max: 10000, currency: 'USD' },
      industry: ['Technology'],
      experienceLevel: 'mid'
    }));
  }

  /**
   * Get default match factors when not available
   */
  private getDefaultMatchFactors(): MatchFactors {
    return {
      skillMatch: 50,
      experienceMatch: 50,
      industryMatch: 50,
      locationMatch: 50,
      budgetMatch: 50,
      availabilityMatch: 50,
      careerMatch: 50,
      cultureMatch: 50
    };
  }

  /**
   * Notify matched users about opportunities
   */
  async notifyMatchedUsers(matchingResult: MatchingResult): Promise<void> {
    try {
      logger.info('MatchingService: Notifying matched users', {
        opportunityId: matchingResult.opportunityId,
        matchesCount: matchingResult.matches.length
      });

      // TODO: Implement actual notification system
      // This would integrate with the notification service to send personalized notifications

      for (const match of matchingResult.matches) {
        if (match.overallScore >= 70) { // Only notify high-quality matches
          await this.sendMatchNotification(match, matchingResult.opportunityId);
        }
      }

    } catch (error) {
      logger.error('MatchingService: Failed to notify users', { error });
    }
  }

  /**
   * Send notification to individual matched user
   */
  private async sendMatchNotification(match: UserMatch, opportunityId: string): Promise<void> {
    // TODO: Implement actual notification sending
    // This would create a notification record and potentially send email/push notification

    logger.info('MatchingService: Sending match notification', {
      userId: match.userId,
      opportunityId,
      matchScore: match.overallScore,
      explanation: match.explanation
    });

    // Placeholder for notification creation
    // await notificationService.createNotification({
    //   type: 'OPPORTUNITY_MATCHED_AI',
    //   userId: match.userId,
    //   opportunityId,
    //   matchScore: match.overallScore,
    //   matchReason: match.explanation
    // });
  }

  /**
   * Get matching analytics for reporting
   */
  async getMatchingAnalytics(timeframe: { start: Date; end: Date }): Promise<{
    totalMatches: number;
    averageMatchScore: number;
    topMatchingFactors: string[];
    matchSuccessRate: number;
  }> {
    // TODO: Implement analytics based on actual match data
    logger.info('MatchingService: getMatchingAnalytics - Placeholder implementation');

    return {
      totalMatches: 0,
      averageMatchScore: 75.5,
      topMatchingFactors: ['skillMatch', 'experienceMatch', 'industryMatch'],
      matchSuccessRate: 0.68
    };
  }
}

/**
 * Convenience function for matching opportunities
 */
export async function matchOpportunityUsers(opportunity: Opportunity): Promise<MatchingResult> {
  const service = new OpportunityMatchingService();
  return await service.findMatches(opportunity);
}

/**
 * Convenience function for matching with notifications
 */
export async function matchAndNotifyUsers(opportunity: Opportunity): Promise<MatchingResult> {
  const service = new OpportunityMatchingService();
  const result = await service.findMatches(opportunity);
  await service.notifyMatchedUsers(result);
  return result;
}
