/**
 * Security Pipeline Orchestrator
 * ==============================
 * Coordinates all 4 defense layers for email processing
 * Reference: Prompt Injection Prevention Specialist skillset
 * 
 * Pipeline Flow:
 * 1. Input Sanitization → Remove dangerous chars, detect patterns
 * 2. Injection Classifier → AI-based attack detection (if needed)
 * 3. Spotlighting → Apply datamarking before AI processing
 * 4. Output Validation → Verify AI response is safe
 */

import { createHash } from 'crypto';
import { InputSanitizer, SanitizationResult, getInputSanitizer } from './input-sanitizer';
import { InjectionClassifier, InjectionClassification, getInjectionClassifier } from './injection-classifier';
import { Spotlighting, SpotlightedEmail, getSpotlighting, SYSTEM_PROMPT_WITH_SPOTLIGHTING } from './spotlighting';
import { OutputValidator, OutputValidation, getOutputValidator } from './output-validator';
import { logger } from '@/lib/logger';

export interface SecurityCheckResult {
  // Overall status
  passed: boolean;
  blocked: boolean;
  requiresReview: boolean;
  
  // Risk assessment
  totalRiskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  
  // Layer results
  sanitization: SanitizationResult;
  classification: InjectionClassification | null; // Only if needed
  spotlighting: SpotlightedEmail | null;
  
  // Processed content
  sanitizedContent: string;
  securePrompt: { systemPrompt: string; userPrompt: string } | null;
  
  // Audit trail
  checkId: string;
  timestamp: Date;
  processingTimeMs: number;
}

export interface OutputCheckResult {
  // Overall status
  passed: boolean;
  requiresReview: boolean;
  
  // Validation result
  validation: OutputValidation;
  
  // Safe content
  safeContent: string | null;
  
  // Audit trail
  checkId: string;
  timestamp: Date;
}

export class SecurityPipeline {
  private sanitizer: InputSanitizer;
  private classifier: InjectionClassifier;
  private spotlighting: Spotlighting;
  private validator: OutputValidator;
  
  // Configuration
  private config = {
    // Skip AI classification for very low risk content
    skipClassificationThreshold: 0.1,
    // Always classify if risk is above this
    forceClassificationThreshold: 0.3,
    // Block without classification if above this
    autoBlockThreshold: 0.75,
    // Use fast heuristic check first
    useQuickCheck: true,
  };
  
  constructor() {
    this.sanitizer = getInputSanitizer();
    this.classifier = getInjectionClassifier();
    this.spotlighting = getSpotlighting();
    this.validator = getOutputValidator();
  }
  
  /**
   * Run full security check on inbound email
   * Call this BEFORE AI processing
   */
  async checkInbound(email: {
    subject: string;
    from: string;
    fromName?: string;
    body: string;
    headers?: Record<string, string>;
    attachmentNames?: string[];
  }): Promise<SecurityCheckResult> {
    const startTime = Date.now();
    const checkId = this.generateCheckId();
    
    logger.info('[SecurityPipeline] Starting inbound check', {
      checkId,
      from: email.from,
      subjectLength: email.subject.length,
      bodyLength: email.body.length,
    });
    
    // Layer 1: Input Sanitization
    const sanitization = this.sanitizer.sanitize(email.body);
    const subjectSanitized = this.sanitizer.sanitizeSubject(email.subject);
    
    // Early exit for auto-block
    if (sanitization.riskScore >= this.config.autoBlockThreshold) {
      const processingTimeMs = Date.now() - startTime;
      
      logger.warn('[SecurityPipeline] Auto-blocked due to high risk', {
        checkId,
        riskScore: sanitization.riskScore,
        patternCount: sanitization.flaggedPatterns.length,
        processingTimeMs,
      });
      
      return {
        passed: false,
        blocked: true,
        requiresReview: true,
        totalRiskScore: sanitization.riskScore,
        riskLevel: 'critical',
        sanitization,
        classification: null,
        spotlighting: null,
        sanitizedContent: sanitization.sanitizedContent,
        securePrompt: null,
        checkId,
        timestamp: new Date(),
        processingTimeMs,
      };
    }
    
    // Layer 2: Injection Classification (conditional)
    let classification: InjectionClassification | null = null;
    
    if (this.shouldRunClassifier(sanitization)) {
      classification = await this.classifier.classify(
        sanitization.sanitizedContent,
        sanitization
      );
      
      // Check if classifier says to block
      if (classification.shouldBlock) {
        const processingTimeMs = Date.now() - startTime;
        
        logger.warn('[SecurityPipeline] Blocked by classifier', {
          checkId,
          technique: classification.technique,
          confidence: classification.confidence,
          processingTimeMs,
        });
        
        return {
          passed: false,
          blocked: true,
          requiresReview: true,
          totalRiskScore: Math.max(sanitization.riskScore, classification.confidence),
          riskLevel: 'high',
          sanitization,
          classification,
          spotlighting: null,
          sanitizedContent: sanitization.sanitizedContent,
          securePrompt: null,
          checkId,
          timestamp: new Date(),
          processingTimeMs,
        };
      }
    }
    
    // Layer 3: Apply Spotlighting
    const spotlightedEmail = this.spotlighting.markEmail({
      subject: subjectSanitized,
      from: this.sanitizer.sanitizeEmail(email.from),
      fromName: email.fromName,
      body: sanitization.sanitizedContent,
      headers: email.headers,
      attachmentNames: email.attachmentNames,
    });
    
    // Generate secure prompt
    const securePrompt = this.spotlighting.generateSecurePrompt({
      subject: subjectSanitized,
      from: email.from,
      fromName: email.fromName,
      body: sanitization.sanitizedContent,
      headers: email.headers,
      attachmentNames: email.attachmentNames,
    });
    
    // Calculate final risk
    const totalRiskScore = this.calculateTotalRisk(sanitization, classification);
    const riskLevel = this.determineRiskLevel(totalRiskScore);
    const requiresReview = classification?.requiresReview || riskLevel === 'medium' || riskLevel === 'high';
    
    const processingTimeMs = Date.now() - startTime;
    
    logger.info('[SecurityPipeline] Inbound check complete', {
      checkId,
      passed: true,
      totalRiskScore,
      riskLevel,
      requiresReview,
      processingTimeMs,
    });
    
    return {
      passed: true,
      blocked: false,
      requiresReview,
      totalRiskScore,
      riskLevel,
      sanitization,
      classification,
      spotlighting: spotlightedEmail,
      sanitizedContent: sanitization.sanitizedContent,
      securePrompt,
      checkId,
      timestamp: new Date(),
      processingTimeMs,
    };
  }
  
  /**
   * Validate AI-generated response
   * Call this AFTER AI processing, BEFORE sending
   */
  checkOutput(response: string, context?: { isAutoReply?: boolean }): OutputCheckResult {
    const checkId = this.generateCheckId();
    
    logger.info('[SecurityPipeline] Starting output check', {
      checkId,
      responseLength: response.length,
    });
    
    // Layer 4: Output Validation
    const validation = this.validator.validate(response);
    
    // Validate length if context provided
    if (context?.isAutoReply !== undefined) {
      const lengthCheck = this.validator.validateLength(response, {
        isAutoReply: context.isAutoReply,
      });
      
      if (!lengthCheck.isValid) {
        validation.violations.push({
          type: 'policy_violation',
          severity: 'medium',
          description: lengthCheck.message || 'Length validation failed',
          remediation: 'Adjust response length',
        });
        validation.requiresReview = true;
      }
    }
    
    const result: OutputCheckResult = {
      passed: validation.isValid,
      requiresReview: validation.requiresReview,
      validation,
      safeContent: validation.modifiedContent || (validation.isValid ? response : null),
      checkId,
      timestamp: new Date(),
    };
    
    logger.info('[SecurityPipeline] Output check complete', {
      checkId,
      passed: result.passed,
      requiresReview: result.requiresReview,
      violationCount: validation.violations.length,
    });
    
    return result;
  }
  
  /**
   * Get system prompt with spotlighting (for use in AI calls)
   */
  getSecureSystemPrompt(): string {
    return SYSTEM_PROMPT_WITH_SPOTLIGHTING;
  }
  
  /**
   * Determine if classifier should run based on sanitization results
   */
  private shouldRunClassifier(sanitization: SanitizationResult): boolean {
    // Always run if risk is above force threshold
    if (sanitization.riskScore >= this.config.forceClassificationThreshold) {
      return true;
    }
    
    // Skip if risk is very low
    if (sanitization.riskScore <= this.config.skipClassificationThreshold) {
      // But still run quick check if enabled
      if (this.config.useQuickCheck) {
        const quickResult = this.classifier.quickCheck(sanitization.sanitizedContent);
        return quickResult.suspicious;
      }
      return false;
    }
    
    // For medium risk, run classifier
    return true;
  }
  
  /**
   * Calculate combined risk score
   */
  private calculateTotalRisk(
    sanitization: SanitizationResult,
    classification: InjectionClassification | null
  ): number {
    if (!classification) {
      return sanitization.riskScore;
    }
    
    // Weight: 40% sanitizer, 60% classifier (when available)
    return sanitization.riskScore * 0.4 + classification.confidence * 0.6;
  }
  
  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (score < 0.1) return 'safe';
    if (score < 0.25) return 'low';
    if (score < 0.5) return 'medium';
    if (score < 0.75) return 'high';
    return 'critical';
  }
  
  /**
   * Generate unique check ID for audit trail
   */
  private generateCheckId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `sec_${timestamp}_${random}`;
  }
}

// Singleton instance
let pipelineInstance: SecurityPipeline | null = null;

export function getSecurityPipeline(): SecurityPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new SecurityPipeline();
  }
  return pipelineInstance;
}

export default SecurityPipeline;
