/**
 * Email Security Module
 * =====================
 * 4-Layer Defense Against Prompt Injection
 * 
 * Layers:
 * 1. Input Sanitization - Pattern detection and character removal
 * 2. Injection Classifier - AI-based attack detection (Haiku)
 * 3. Spotlighting - Datamarking for untrusted content
 * 4. Output Validation - Response safety verification
 */

// Layer 1: Input Sanitization
export { 
  InputSanitizer, 
  getInputSanitizer 
} from './input-sanitizer';
export type { 
  SanitizationResult, 
  FlaggedPattern, 
  PatternType 
} from './input-sanitizer';

// Layer 2: Injection Classifier
export { 
  InjectionClassifier, 
  getInjectionClassifier 
} from './injection-classifier';
export type { 
  InjectionClassification, 
  InjectionTechnique 
} from './injection-classifier';

// Layer 3: Spotlighting
export { 
  Spotlighting, 
  getSpotlighting, 
  SYSTEM_PROMPT_WITH_SPOTLIGHTING 
} from './spotlighting';
export type { 
  SpotlightedContent, 
  SpotlightedEmail 
} from './spotlighting';

// Layer 4: Output Validation
export { 
  OutputValidator, 
  getOutputValidator 
} from './output-validator';
export type { 
  OutputValidation, 
  ValidationViolation, 
  ViolationType 
} from './output-validator';

// Orchestration Pipeline
export { 
  SecurityPipeline, 
  getSecurityPipeline 
} from './security-pipeline';
export type { 
  SecurityCheckResult, 
  OutputCheckResult 
} from './security-pipeline';
