/**
 * Opportunity Auto-Fill Service
 *
 * Analyzes opportunity input and auto-fills missing fields using LLM analysis.
 * Enhances opportunities with intelligent suggestions for tags, skills, budget, etc.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

import type { OpportunityInput, AutoFillAnalysis, EnrichedOpportunity } from '@/lib/ai/types';
import { createLLMClient, isLLMAvailable } from '@/lib/ai/llm-client';
import { AIOperationError } from '@/lib/ai/types';
import { logger } from '@/lib/logger';

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

/**
 * Service for auto-filling opportunity fields using LLM analysis
 */
export class OpportunityAutoFillService {
  private llmClient = createLLMClient();

  /**
   * Analyze and enrich an opportunity with auto-filled fields
   */
  async enrichOpportunity(opportunityInput: OpportunityInput): Promise<AutoFillResult> {
    const startTime = Date.now();

    try {
      logger.info('AutoFillService: Starting opportunity enrichment', {
        opportunityId: opportunityInput.id,
        title: opportunityInput.title
      });

      // Use LLM for intelligent analysis if available
      if (isLLMAvailable()) {
        return await this.llmBasedEnrichment(opportunityInput, startTime);
      } else {
        logger.warn('AutoFillService: LLM unavailable, using baseline enrichment');
        return await this.baselineEnrichment(opportunityInput, startTime);
      }

    } catch (error) {
      logger.error('AutoFillService: Enrichment failed', { error, opportunityId: opportunityInput.id });
      return await this.baselineEnrichment(opportunityInput, startTime);
    }
  }

  /**
   * LLM-powered opportunity enrichment
   */
  private async llmBasedEnrichment(
    opportunityInput: OpportunityInput,
    startTime: number
  ): Promise<AutoFillResult> {
    const prompt = this.createAutoFillPrompt(opportunityInput);

    try {
      const response = await this.llmClient.complete(prompt, {
        temperature: 0.4, // Moderate creativity for analysis
        maxTokens: 1500
      });

      const analysis = this.parseAutoFillResponse(response.content);
      const enrichedOpportunity = this.applyAutoFillAnalysis(opportunityInput, analysis);
      const suggestions = this.generateSuggestions(analysis);

      const result: AutoFillResult = {
        enrichedOpportunity,
        confidence: analysis.confidence,
        processingTime: Date.now() - startTime,
        suggestions
      };

      logger.info('AutoFillService: LLM enrichment completed', {
        opportunityId: opportunityInput.id,
        confidence: analysis.confidence,
        autoFilledFields: suggestions.length,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('AutoFillService: LLM enrichment failed', { error });
      throw new AIOperationError('LLM enrichment failed', 'auto_fill', error);
    }
  }

  /**
   * Baseline enrichment using simple heuristics (fallback)
   */
  private async baselineEnrichment(
    opportunityInput: OpportunityInput,
    startTime: number
  ): Promise<AutoFillResult> {
    const analysis = this.baselineAnalysis(opportunityInput);
    const enrichedOpportunity = this.applyAutoFillAnalysis(opportunityInput, analysis);
    const suggestions = this.generateSuggestions(analysis);

    return {
      enrichedOpportunity,
      confidence: 0.3, // Lower confidence for baseline method
      processingTime: Date.now() - startTime,
      suggestions
    };
  }

  /**
   * Create LLM prompt for auto-fill analysis
   */
  private createAutoFillPrompt(opportunity: OpportunityInput): string {
    return `Analyze this opportunity and suggest auto-fill values for missing fields. Focus on providing intelligent, market-appropriate suggestions.

OPPORTUNITY INPUT:
Title: ${opportunity.title}
Type: ${opportunity.type}
Description: ${opportunity.description}
Current Tags: ${opportunity.tags?.join(', ') || 'None provided'}
Current Required Skills: ${opportunity.requiredSkills?.join(', ') || 'None provided'}
Location: ${opportunity.location || 'Not specified'}
Budget: ${opportunity.budget ? `${opportunity.budget.currency || 'USD'} ${opportunity.budget.min || 0}-${opportunity.budget.max || 'unlimited'}` : 'Not specified'}

INSTRUCTIONS:
Analyze the opportunity and provide intelligent suggestions for missing or incomplete fields. Consider:
1. Industry context and market rates
2. Required experience level based on description complexity
3. Realistic budget ranges for the type of work
4. Relevant skills that would be needed
5. Work type preferences (remote/hybrid/onsite)
6. Realistic timeline estimates
7. Company size implications

Return JSON format:
{
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "estimatedBudget": {
    "min": 5000,
    "max": 15000,
    "currency": "USD",
    "reasoning": "Based on market rates for similar projects"
  },
  "requiredSkills": ["skill1", "skill2", "skill3"],
  "industryCategory": "technology",
  "locationPreference": "remote",
  "experienceLevel": "mid",
  "urgency": "medium",
  "estimatedDuration": "3 months",
  "companySize": "startup",
  "workType": "contract",
  "confidence": 0.85,
  "reasoning": "Detailed explanation of analysis and confidence factors"
}`;
  }

  /**
   * Parse LLM response for auto-fill analysis
   */
  private parseAutoFillResponse(response: string): AutoFillAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields and provide defaults
      return {
        suggestedTags: parsed.suggestedTags || [],
        estimatedBudget: parsed.estimatedBudget ? {
          min: parsed.estimatedBudget.min || 0,
          max: parsed.estimatedBudget.max || 0,
          currency: parsed.estimatedBudget.currency || 'USD',
          reasoning: parsed.estimatedBudget.reasoning || 'Market-based estimation'
        } : undefined,
        requiredSkills: parsed.requiredSkills || [],
        industryCategory: parsed.industryCategory || 'general',
        locationPreference: parsed.locationPreference || 'remote',
        experienceLevel: parsed.experienceLevel || 'mid',
        urgency: parsed.urgency || 'medium',
        estimatedDuration: parsed.estimatedDuration,
        companySize: parsed.companySize,
        workType: parsed.workType || 'full-time',
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        reasoning: parsed.reasoning || 'LLM-based analysis'
      };

    } catch (error) {
      logger.error('AutoFillService: Failed to parse auto-fill response', { response, error });
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Apply auto-fill analysis to opportunity input
   */
  private applyAutoFillAnalysis(
    original: OpportunityInput,
    analysis: AutoFillAnalysis
  ): EnrichedOpportunity {
    return {
      ...original,
      // Auto-fill missing tags
      suggestedTags: analysis.suggestedTags,

      // Auto-fill budget if not provided and confidence is high enough
      ...(original.budget ? {} : analysis.estimatedBudget && analysis.confidence > 0.7 ? {
        budget: {
          min: analysis.estimatedBudget.min,
          max: analysis.estimatedBudget.max,
          currency: analysis.estimatedBudget.currency
        }
      } : {}),

      // Auto-fill required skills if not provided
      requiredSkills: original.requiredSkills?.length ?
        original.requiredSkills :
        analysis.requiredSkills,

      // Auto-fill other fields if not provided
      industryCategory: original.industryCategory || analysis.industryCategory,
      locationPreference: (original as any).locationPreference || analysis.locationPreference,
      experienceLevel: (original.experienceLevel || analysis.experienceLevel) as 'junior' | 'mid' | 'senior' | 'lead',
      urgency: (original as any).urgency || analysis.urgency,
      estimatedDuration: original.estimatedDuration || analysis.estimatedDuration,
      companySize: (original as any).companySize || analysis.companySize,
      workType: (original.workType || analysis.workType) as 'contract' | 'full-time' | 'part-time' | 'freelance',

      // Metadata
      enrichmentMetadata: {
        confidence: analysis.confidence,
        autoFilledFields: this.getAutoFilledFields(original, analysis),
        processingTime: 0 // Will be set by caller
      }
    };
  }

  /**
   * Generate suggestions list from analysis
   */
  private generateSuggestions(analysis: AutoFillAnalysis): AutoFillResult['suggestions'] {
    const suggestions: AutoFillResult['suggestions'] = [];

    if (analysis.suggestedTags.length > 0) {
      suggestions.push({
        field: 'suggestedTags',
        value: analysis.suggestedTags,
        confidence: analysis.confidence,
        reasoning: `Suggested tags based on opportunity content: ${analysis.suggestedTags.slice(0, 3).join(', ')}`
      });
    }

    if (analysis.estimatedBudget) {
      suggestions.push({
        field: 'estimatedBudget',
        value: analysis.estimatedBudget,
        confidence: analysis.confidence,
        reasoning: analysis.estimatedBudget.reasoning
      });
    }

    if (analysis.requiredSkills.length > 0) {
      suggestions.push({
        field: 'requiredSkills',
        value: analysis.requiredSkills,
        confidence: analysis.confidence,
        reasoning: `Required skills analysis: ${analysis.requiredSkills.join(', ')}`
      });
    }

    // Add other field suggestions with lower confidence
    const fieldSuggestions = [
      { field: 'industryCategory', value: analysis.industryCategory, reasoning: 'Industry classification' },
      { field: 'locationPreference', value: analysis.locationPreference, reasoning: 'Location preference analysis' },
      { field: 'experienceLevel', value: analysis.experienceLevel, reasoning: 'Experience level assessment' },
      { field: 'workType', value: analysis.workType, reasoning: 'Work type classification' }
    ];

    fieldSuggestions.forEach(({ field, value, reasoning }) => {
      if (value) {
        suggestions.push({
          field,
          value,
          confidence: analysis.confidence * 0.8, // Slightly lower confidence for secondary fields
          reasoning
        });
      }
    });

    return suggestions;
  }

  /**
   * Baseline analysis using simple heuristics
   */
  private baselineAnalysis(opportunity: OpportunityInput): AutoFillAnalysis {
    const description = (opportunity.title + ' ' + opportunity.description).toLowerCase();

    // Simple tag extraction
    const suggestedTags = this.extractTagsFromText(description);

    // Simple skill extraction
    const requiredSkills = this.extractSkillsFromText(description);

    // Basic industry detection
    const industryCategory = this.detectIndustry(description);

    // Simple budget estimation
    const estimatedBudget = this.estimateBudget(description, opportunity.type);

    return {
      suggestedTags,
      estimatedBudget,
      requiredSkills,
      industryCategory,
      locationPreference: 'remote', // Default assumption
      experienceLevel: this.detectExperienceLevel(description) as 'junior' | 'mid' | 'senior' | 'lead',
      urgency: 'medium',
      estimatedDuration: this.estimateDuration(description),
      companySize: 'startup', // Default assumption
      workType: opportunity.type === 'request' ? 'contract' : 'full-time',
      confidence: 0.3,
      reasoning: 'Baseline heuristic analysis'
    };
  }

  /**
   * Get list of auto-filled fields
   */
  private getAutoFilledFields(original: OpportunityInput, analysis: AutoFillAnalysis): string[] {
    const autoFilled: string[] = [];

    if (!original.tags?.length && analysis.suggestedTags.length) {
      autoFilled.push('tags');
    }

    if (!original.budget && analysis.estimatedBudget) {
      autoFilled.push('budget');
    }

    if (!original.requiredSkills?.length && analysis.requiredSkills.length) {
      autoFilled.push('requiredSkills');
    }

    if (!original.industryCategory && analysis.industryCategory !== 'general') {
      autoFilled.push('industryCategory');
    }

    if (!original.experienceLevel && analysis.experienceLevel) {
      autoFilled.push('experienceLevel');
    }

    if (!original.workType && analysis.workType) {
      autoFilled.push('workType');
    }

    return autoFilled;
  }

  /**
   * Default analysis when parsing fails
   */
  private getDefaultAnalysis(): AutoFillAnalysis {
    return {
      suggestedTags: [],
      requiredSkills: [],
      industryCategory: 'general',
      locationPreference: 'remote',
      experienceLevel: 'mid',
      urgency: 'medium',
      workType: 'full-time',
      confidence: 0.1,
      reasoning: 'Default analysis due to parsing failure'
    };
  }

  // Helper methods for baseline analysis
  private extractTagsFromText(text: string): string[] {
    const commonTags = [
      'javascript', 'python', 'react', 'node', 'web', 'mobile', 'api', 'database',
      'design', 'marketing', 'sales', 'consulting', 'development', 'testing'
    ];

    return commonTags.filter(tag => text.includes(tag)).slice(0, 5);
  }

  private extractSkillsFromText(text: string): string[] {
    const commonSkills = [
      'JavaScript', 'Python', 'React', 'Node.js', 'HTML', 'CSS', 'SQL', 'Git',
      'AWS', 'Docker', 'Kubernetes', 'TypeScript', 'GraphQL', 'REST API'
    ];

    return commonSkills.filter(skill =>
      text.includes(skill.toLowerCase())
    ).slice(0, 5);
  }

  private detectIndustry(text: string): string {
    if (text.includes('web') || text.includes('app') || text.includes('software')) return 'technology';
    if (text.includes('design') || text.includes('ui') || text.includes('ux')) return 'design';
    if (text.includes('marketing') || text.includes('brand')) return 'marketing';
    if (text.includes('finance') || text.includes('accounting')) return 'finance';
    return 'general';
  }

  private estimateBudget(text: string, type: string): AutoFillAnalysis['estimatedBudget'] {
    // Simple budget estimation based on keywords
    if (text.includes('complex') || text.includes('enterprise')) {
      return { min: 10000, max: 50000, currency: 'USD', reasoning: 'Complex project estimation' };
    }
    if (text.includes('simple') || text.includes('basic')) {
      return { min: 1000, max: 5000, currency: 'USD', reasoning: 'Simple project estimation' };
    }
    return { min: 5000, max: 15000, currency: 'USD', reasoning: 'Standard project estimation' };
  }

  private detectExperienceLevel(text: string): string {
    if (text.includes('senior') || text.includes('expert') || text.includes('lead')) return 'senior';
    if (text.includes('junior') || text.includes('entry')) return 'junior';
    return 'mid';
  }

  private estimateDuration(text: string): string {
    if (text.includes('quick') || text.includes('short')) return '1 month';
    if (text.includes('long') || text.includes('complex')) return '6 months';
    return '3 months';
  }
}

/**
 * Convenience function for auto-filling opportunities
 */
export async function autoFillOpportunity(opportunityInput: OpportunityInput): Promise<AutoFillResult> {
  const service = new OpportunityAutoFillService();
  return await service.enrichOpportunity(opportunityInput);
}
