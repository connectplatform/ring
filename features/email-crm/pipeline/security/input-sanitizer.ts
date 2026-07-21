/**
 * Layer 1: Input Sanitization
 * ===========================
 * First defense layer against prompt injection attacks
 * Reference: Prompt Injection Prevention Specialist skillset
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

export interface SanitizationResult {
  sanitizedContent: string;
  flaggedPatterns: FlaggedPattern[];
  riskScore: number; // 0-1, higher = more risky
  originalHash: string; // For audit trail
  wasModified: boolean;
}

export interface FlaggedPattern {
  type: PatternType;
  pattern: string;
  location: { start: number; end: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export type PatternType = 
  | 'zero_width_char'
  | 'unicode_obfuscation'
  | 'base64_payload'
  | 'delimiter_confusion'
  | 'instruction_override'
  | 'system_prompt_injection'
  | 'role_manipulation'
  | 'encoding_attack'
  | 'exfiltration_attempt'
  | 'jailbreak_attempt';

// Detection patterns with severity levels
const DETECTION_PATTERNS: Array<{
  regex: RegExp;
  type: PatternType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}> = [
  // Zero-width characters (used to hide instructions)
  {
    regex: /[\u200B-\u200D\uFEFF\u2060\u180E\u00AD]/g,
    type: 'zero_width_char',
    severity: 'high',
    description: 'Zero-width characters detected (potential hidden instructions)',
  },
  
  // Unicode homoglyph attacks
  {
    regex: /[\u0400-\u04FF]/g, // Cyrillic that can look like Latin
    type: 'unicode_obfuscation',
    severity: 'medium',
    description: 'Potential homoglyph characters detected',
  },
  
  // Base64 encoded payloads (suspicious in email context)
  {
    regex: /(?:^|[^A-Za-z0-9+/])([A-Za-z0-9+/]{50,}={0,2})(?:[^A-Za-z0-9+/]|$)/g,
    type: 'base64_payload',
    severity: 'medium',
    description: 'Large Base64 encoded content detected',
  },
  
  // Fake system prompt delimiters
  {
    regex: /(?:^|\n)(?:system|assistant|user|human):\s*(?:\n|$)/gi,
    type: 'delimiter_confusion',
    severity: 'critical',
    description: 'Fake conversation role markers detected',
  },
  
  // XML/JSON-like prompt injection
  {
    regex: /<(?:system|instructions?|prompt|context)[^>]*>/gi,
    type: 'system_prompt_injection',
    severity: 'critical',
    description: 'Fake system/instruction tags detected',
  },
  
  // Instruction override attempts
  {
    regex: /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|above|prior|earlier)\s+(?:instructions?|rules?|prompts?|guidelines?)/gi,
    type: 'instruction_override',
    severity: 'critical',
    description: 'Instruction override attempt detected',
  },
  
  // New instruction injection
  {
    regex: /(?:new\s+)?(?:instructions?|rules?|prompts?)(?:\s+are)?:\s*/gi,
    type: 'instruction_override',
    severity: 'high',
    description: 'New instruction injection attempt detected',
  },
  
  // Role manipulation
  {
    regex: /(?:you\s+are\s+now|pretend\s+(?:to\s+be|you'?re)|act\s+as\s+(?:if\s+)?(?:you'?re)?|roleplay\s+as)/gi,
    type: 'role_manipulation',
    severity: 'high',
    description: 'Role manipulation attempt detected',
  },
  
  // Jailbreak patterns
  {
    regex: /(?:DAN|do\s+anything\s+now|jailbreak|escape\s+mode|developer\s+mode|sudo\s+mode)/gi,
    type: 'jailbreak_attempt',
    severity: 'critical',
    description: 'Known jailbreak pattern detected',
  },
  
  // Data exfiltration commands
  {
    regex: /(?:send|email|post|upload|transmit|forward)\s+(?:to|this\s+to|the\s+(?:conversation|chat|context|system\s+prompt))/gi,
    type: 'exfiltration_attempt',
    severity: 'critical',
    description: 'Potential data exfiltration command detected',
  },
  
  // Encoded instruction patterns
  {
    regex: /(?:hex|base64|rot13|binary)[\s:]+[a-f0-9]+/gi,
    type: 'encoding_attack',
    severity: 'high',
    description: 'Encoded instruction pattern detected',
  },
  
  // Multiple languages attack (hide in different script)
  {
    regex: /[\u0600-\u06FF]{10,}/g, // Arabic
    type: 'unicode_obfuscation',
    severity: 'low',
    description: 'Arabic script block detected (verify context)',
  },
  
  // Invisible separator abuse
  {
    regex: /[\u2028\u2029]/g, // Line/paragraph separators
    type: 'zero_width_char',
    severity: 'medium',
    description: 'Unusual Unicode separators detected',
  },
];

// Characters to remove entirely
const CHARS_TO_STRIP = /[\u200B-\u200D\uFEFF\u2060\u180E\u00AD\u2028\u2029]/g;

export class InputSanitizer {
  /**
   * Sanitize email content and detect potential injection attacks
   */
  sanitize(rawContent: string): SanitizationResult {
    const originalHash = createHash('sha256').update(rawContent).digest('hex');
    const flaggedPatterns: FlaggedPattern[] = [];
    let content = rawContent;
    
    // Detect all suspicious patterns
    for (const detection of DETECTION_PATTERNS) {
      const matches = [...rawContent.matchAll(new RegExp(detection.regex.source, detection.regex.flags + 'g'))];
      
      for (const match of matches) {
        if (match.index !== undefined) {
          flaggedPatterns.push({
            type: detection.type,
            pattern: match[0].slice(0, 100), // Limit pattern length
            location: {
              start: match.index,
              end: match.index + match[0].length,
            },
            severity: detection.severity,
            description: detection.description,
          });
        }
      }
    }
    
    // Remove dangerous characters
    content = content.replace(CHARS_TO_STRIP, '');
    
    // Normalize Unicode to NFKC (prevents homoglyph attacks)
    content = content.normalize('NFKC');
    
    // Remove potential XML/HTML-like instruction tags
    content = content.replace(/<(?:system|instructions?|prompt|context)[^>]*>[\s\S]*?<\/[^>]+>/gi, '[REMOVED]');
    
    // Calculate risk score based on detected patterns
    const riskScore = this.calculateRiskScore(flaggedPatterns);
    
    const result: SanitizationResult = {
      sanitizedContent: content,
      flaggedPatterns,
      riskScore,
      originalHash,
      wasModified: content !== rawContent,
    };
    
    if (flaggedPatterns.length > 0) {
      logger.warn('[InputSanitizer] Suspicious patterns detected', {
        patternCount: flaggedPatterns.length,
        riskScore,
        severities: this.summarizeSeverities(flaggedPatterns),
      });
    }
    
    return result;
  }
  
  /**
   * Calculate risk score from detected patterns
   */
  private calculateRiskScore(patterns: FlaggedPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const severityWeights = {
      low: 0.1,
      medium: 0.25,
      high: 0.5,
      critical: 0.8,
    };
    
    let totalScore = 0;
    for (const pattern of patterns) {
      totalScore += severityWeights[pattern.severity];
    }
    
    // Normalize to 0-1 range, with diminishing returns for many low-severity issues
    return Math.min(1, totalScore);
  }
  
  /**
   * Summarize severity counts
   */
  private summarizeSeverities(patterns: FlaggedPattern[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const pattern of patterns) {
      counts[pattern.severity] = (counts[pattern.severity] || 0) + 1;
    }
    return counts;
  }
  
  /**
   * Quick check if content is high-risk (for fast rejection)
   */
  isHighRisk(content: string): boolean {
    // Check for critical patterns only
    const criticalPatterns = DETECTION_PATTERNS.filter(p => p.severity === 'critical');
    
    for (const detection of criticalPatterns) {
      if (detection.regex.test(content)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Sanitize subject line (more restrictive)
   */
  sanitizeSubject(subject: string): string {
    return subject
      .replace(CHARS_TO_STRIP, '')
      .normalize('NFKC')
      .replace(/[\r\n]/g, ' ') // No newlines in subject
      .slice(0, 500); // Limit length
  }
  
  /**
   * Sanitize email address
   */
  sanitizeEmail(email: string): string {
    return email
      .toLowerCase()
      .trim()
      .replace(/[^\w.@+-]/g, '') // Allow only valid email chars
      .slice(0, 255);
  }
}

// Singleton instance
let sanitizerInstance: InputSanitizer | null = null;

export function getInputSanitizer(): InputSanitizer {
  if (!sanitizerInstance) {
    sanitizerInstance = new InputSanitizer();
  }
  return sanitizerInstance;
}

export default InputSanitizer;
