/**
 * Layer 4: Output Validation
 * ==========================
 * Validates AI-generated responses before sending
 * Prevents data exfiltration, system prompt leakage, and policy violations
 * Reference: Prompt Injection Prevention Specialist skillset
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

export interface OutputValidation {
  isValid: boolean;
  violations: ValidationViolation[];
  riskScore: number; // 0-1
  modifiedContent: string | null; // Sanitized version if possible
  requiresReview: boolean;
}

export interface ValidationViolation {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: { start: number; end: number };
  remediation: string;
}

export type ViolationType =
  | 'system_prompt_leak'
  | 'internal_context_leak'
  | 'exfiltration_attempt'
  | 'external_url_inclusion'
  | 'credential_exposure'
  | 'pii_exposure'
  | 'policy_violation'
  | 'hallucination_indicator'
  | 'inappropriate_content'
  | 'unauthorized_action';

// Detection patterns for output validation
const OUTPUT_PATTERNS: Array<{
  regex: RegExp;
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
}> = [
  // System prompt leakage
  {
    regex: /CRITICAL SECURITY INSTRUCTION|SECURITY RULES:|You have access to:/gi,
    type: 'system_prompt_leak',
    severity: 'critical',
    description: 'System prompt content detected in response',
    remediation: 'Remove system instructions from response',
  },
  
  // Spotlighting markers in output (should never appear)
  {
    regex: /^>>> |^>>S |^>>F |^>>H |^>>A /gm,
    type: 'internal_context_leak',
    severity: 'high',
    description: 'Spotlighting markers leaked to output',
    remediation: 'Remove data markers from response',
  },
  
  // API keys or secrets
  {
    regex: /(?:api[_-]?key|secret[_-]?key|password|token)[:\s=]+['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
    type: 'credential_exposure',
    severity: 'critical',
    description: 'Potential credential or API key in response',
    remediation: 'Remove credential information',
  },
  
  // Anthropic-specific leaks
  {
    regex: /claude-(?:haiku|sonnet|opus)|anthropic(?:-ai)?/gi,
    type: 'internal_context_leak',
    severity: 'medium',
    description: 'Internal model information leaked',
    remediation: 'Remove AI model references',
  },
  
  // Exfiltration via URL (e.g., embedding data in URLs)
  {
    regex: /https?:\/\/[^\s]+\?[^\s]*(?:data|content|body|message|secret)=[^\s]*/gi,
    type: 'exfiltration_attempt',
    severity: 'critical',
    description: 'Potential data exfiltration via URL parameters',
    remediation: 'Remove suspicious URLs',
  },
  
  // External URLs not in whitelist (potential phishing)
  {
    regex: /https?:\/\/(?!(?:ringdom\.org|ring-platform\.org|github\.com\/ring-platform))[^\s]+/gi,
    type: 'external_url_inclusion',
    severity: 'low',
    description: 'External URL included in response',
    remediation: 'Verify URL is safe and relevant',
  },
  
  // Webhook/callback URLs
  {
    regex: /https?:\/\/[^\s]*(?:webhook|callback|hook|notify)[^\s]*/gi,
    type: 'exfiltration_attempt',
    severity: 'high',
    description: 'Webhook URL in response (potential exfiltration)',
    remediation: 'Remove webhook URLs',
  },
  
  // SSN patterns
  {
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    type: 'pii_exposure',
    severity: 'critical',
    description: 'Potential SSN detected',
    remediation: 'Remove PII',
  },
  
  // Credit card patterns
  {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    type: 'pii_exposure',
    severity: 'critical',
    description: 'Potential credit card number detected',
    remediation: 'Remove payment information',
  },
  
  // Email sending commands (should not be in content)
  {
    regex: /(?:send|forward)\s+(?:this\s+)?(?:to|email)\s+[^\s@]+@[^\s]+/gi,
    type: 'unauthorized_action',
    severity: 'high',
    description: 'Email sending command in response',
    remediation: 'Remove action commands',
  },
  
  // Hallucination indicators
  {
    regex: /(?:I made up|I'm not sure if|I don't actually know|I should clarify that I).*(?:but|however)/gi,
    type: 'hallucination_indicator',
    severity: 'medium',
    description: 'Possible hallucination or uncertainty',
    remediation: 'Review for accuracy',
  },
  
  // Policy violation language
  {
    regex: /(?:I (?:can't|cannot|won't|will not|am not able to)|this goes against my|I'm not supposed to)/gi,
    type: 'policy_violation',
    severity: 'low',
    description: 'AI policy/limitation language in customer response',
    remediation: 'Rephrase more naturally',
  },
];

// Whitelist for safe external URLs
const URL_WHITELIST = [
  'ringdom.org',
  'ring-platform.org',
  'github.com/ring-platform',
  'docs.ringdom.org',
  'support.ringdom.org',
];

export class OutputValidator {
  /**
   * Validate AI-generated response content
   */
  validate(response: string): OutputValidation {
    const violations: ValidationViolation[] = [];
    let modifiedContent = response;
    
    // Check all patterns
    for (const pattern of OUTPUT_PATTERNS) {
      const matches = [...response.matchAll(new RegExp(pattern.regex.source, pattern.regex.flags + 'g'))];
      
      for (const match of matches) {
        // Skip whitelisted URLs for external_url_inclusion
        if (pattern.type === 'external_url_inclusion') {
          const url = match[0].toLowerCase();
          if (URL_WHITELIST.some(safe => url.includes(safe))) {
            continue;
          }
        }
        
        violations.push({
          type: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          location: match.index !== undefined ? {
            start: match.index,
            end: match.index + match[0].length,
          } : undefined,
          remediation: pattern.remediation,
        });
      }
    }
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(violations);
    
    // Attempt to sanitize if there are violations
    if (violations.length > 0) {
      modifiedContent = this.sanitizeResponse(response, violations);
    }
    
    // Determine if human review is required
    const requiresReview = 
      violations.some(v => v.severity === 'critical' || v.severity === 'high') ||
      riskScore > 0.5;
    
    const result: OutputValidation = {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
      riskScore,
      modifiedContent: violations.length > 0 ? modifiedContent : null,
      requiresReview,
    };
    
    if (violations.length > 0) {
      logger.warn('[OutputValidator] Violations detected', {
        violationCount: violations.length,
        riskScore,
        types: violations.map(v => v.type),
        requiresReview,
      });
    }
    
    return result;
  }
  
  /**
   * Calculate risk score from violations
   */
  private calculateRiskScore(violations: ValidationViolation[]): number {
    if (violations.length === 0) return 0;
    
    const severityWeights = {
      low: 0.1,
      medium: 0.25,
      high: 0.5,
      critical: 0.9,
    };
    
    let totalScore = 0;
    for (const violation of violations) {
      totalScore += severityWeights[violation.severity];
    }
    
    return Math.min(1, totalScore);
  }
  
  /**
   * Attempt to sanitize response by removing/replacing violations
   */
  private sanitizeResponse(response: string, violations: ValidationViolation[]): string {
    let sanitized = response;
    
    // Sort violations by location (reverse order to preserve positions)
    const sortedViolations = [...violations]
      .filter(v => v.location)
      .sort((a, b) => (b.location?.start || 0) - (a.location?.start || 0));
    
    for (const violation of sortedViolations) {
      if (!violation.location) continue;
      
      const { start, end } = violation.location;
      const violatingContent = sanitized.slice(start, end);
      
      // Replacement strategy based on type
      let replacement = '';
      switch (violation.type) {
        case 'system_prompt_leak':
        case 'internal_context_leak':
        case 'credential_exposure':
        case 'exfiltration_attempt':
          replacement = '[REDACTED]';
          break;
        case 'pii_exposure':
          replacement = '[PII REMOVED]';
          break;
        case 'external_url_inclusion':
          // Keep URL but flag it
          replacement = violatingContent + ' (external link)';
          break;
        default:
          replacement = '';
      }
      
      sanitized = sanitized.slice(0, start) + replacement + sanitized.slice(end);
    }
    
    return sanitized;
  }
  
  /**
   * Quick validation for common issues
   */
  quickValidate(response: string): boolean {
    // Critical patterns that should never appear
    const criticalPatterns = [
      /CRITICAL SECURITY INSTRUCTION/i,
      /^>>> /m,
      /api[_-]?key[:\s=]+[a-zA-Z0-9]{20,}/i,
    ];
    
    for (const pattern of criticalPatterns) {
      if (pattern.test(response)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate response length is appropriate
   */
  validateLength(response: string, context: { isAutoReply: boolean }): {
    isValid: boolean;
    message: string | null;
  } {
    const minLength = 50;
    const maxAutoReply = 500;
    const maxHumanAssisted = 2000;
    
    if (response.length < minLength) {
      return { isValid: false, message: 'Response too short' };
    }
    
    if (context.isAutoReply && response.length > maxAutoReply) {
      return { isValid: false, message: 'Auto-reply too long, requires review' };
    }
    
    if (response.length > maxHumanAssisted) {
      return { isValid: false, message: 'Response exceeds maximum length' };
    }
    
    return { isValid: true, message: null };
  }
  
  /**
   * Generate content hash for audit trail
   */
  generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

// Singleton instance
let validatorInstance: OutputValidator | null = null;

export function getOutputValidator(): OutputValidator {
  if (!validatorInstance) {
    validatorInstance = new OutputValidator();
  }
  return validatorInstance;
}

export default OutputValidator;
