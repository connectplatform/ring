/**
 * Email Intent Classifier
 * =======================
 * Classifies incoming emails by intent using Claude Haiku
 * Reference: Email Automation Specialist skillset
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

// Intent categories for Ring Platform emails
export type EmailIntent = 
  | 'pricing_inquiry'
  | 'technical_support'
  | 'feature_request'
  | 'bug_report'
  | 'partnership'
  | 'documentation_help'
  | 'getting_started'
  | 'account_issue'
  | 'billing_question'
  | 'general_inquiry'
  | 'feedback'
  | 'demo_request'
  | 'enterprise_inquiry'
  | 'complaint'
  | 'spam'
  | 'unknown';

export interface IntentClassification {
  intent: EmailIntent;
  confidence: number; // 0-1
  secondaryIntent: EmailIntent | null;
  secondaryConfidence: number | null;
  suggestedActions: string[];
  requiresHumanReview: boolean;
  reasoning: string;
  tokens: {
    input: number;
    output: number;
  };
}

// Classification prompt
const CLASSIFICATION_PROMPT = `You are an email classifier for Ring Platform (ringdom.org), an open-source React/Next.js Web3 platform.

Classify the email intent into ONE of these categories:

- pricing_inquiry: Questions about pricing, plans, costs
- technical_support: Help with implementation, errors, debugging
- feature_request: Suggestions for new features
- bug_report: Reports of bugs, broken functionality
- partnership: Business partnership proposals
- documentation_help: Questions about documentation
- getting_started: New users needing onboarding help
- account_issue: Login, password, account access problems
- billing_question: Payment, invoices, refunds
- general_inquiry: General questions not fitting other categories
- feedback: Positive or constructive feedback
- demo_request: Requests for product demos
- enterprise_inquiry: Enterprise/large-scale deployment questions
- complaint: Unhappy customer, formal complaint
- spam: Unsolicited marketing, scams, irrelevant
- unknown: Cannot determine intent

Respond in JSON only:
{
  "intent": "category",
  "confidence": 0.0-1.0,
  "secondaryIntent": "category or null",
  "secondaryConfidence": 0.0-1.0 or null,
  "suggestedActions": ["action1", "action2"],
  "requiresHumanReview": boolean,
  "reasoning": "brief explanation"
}`;

export class IntentClassifier {
  private anthropic: Anthropic;
  private model = 'claude-haiku-4-5-20250514';
  
  // Classification thresholds
  private thresholds = {
    autoRespond: 0.85, // Auto-respond if confidence >= this
    humanReview: 0.6,  // Flag for human review if confidence < this
    spamThreshold: 0.75, // Auto-mark as spam if spam confidence >= this
  };
  
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  /**
   * Classify email intent
   */
  async classify(emailContent: {
    subject: string;
    body: string;
    from: string;
    fromName?: string;
  }): Promise<IntentClassification> {
    const emailText = this.formatEmailForClassification(emailContent);
    
    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 300,
        system: CLASSIFICATION_PROMPT,
        messages: [
          {
            role: 'user',
            content: emailText,
          },
          // JSON prefill for structured output
          {
            role: 'assistant',
            content: '{',
          },
        ],
      });
      
      // Extract and parse response
      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      
      // Prepend the opening brace we used for prefill
      const jsonText = '{' + textContent.text;
      const classification = this.parseClassification(jsonText);
      
      // Add token usage
      classification.tokens = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
      
      // Apply review thresholds
      if (classification.confidence < this.thresholds.humanReview) {
        classification.requiresHumanReview = true;
      }
      
      logger.info('[IntentClassifier] Classification complete', {
        intent: classification.intent,
        confidence: classification.confidence,
        requiresHumanReview: classification.requiresHumanReview,
        tokens: classification.tokens,
      });
      
      return classification;
    } catch (error) {
      logger.error('[IntentClassifier] Classification failed', {
        error: (error as Error).message,
      });
      
      // Return unknown on failure
      return {
        intent: 'unknown',
        confidence: 0,
        secondaryIntent: null,
        secondaryConfidence: null,
        suggestedActions: ['manual_review'],
        requiresHumanReview: true,
        reasoning: 'Classification failed: ' + (error as Error).message,
        tokens: { input: 0, output: 0 },
      };
    }
  }
  
  /**
   * Format email for classification prompt
   */
  private formatEmailForClassification(email: {
    subject: string;
    body: string;
    from: string;
    fromName?: string;
  }): string {
    let formatted = `From: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}\n`;
    formatted += `Subject: ${email.subject}\n\n`;
    formatted += `Body:\n${email.body.slice(0, 2000)}`; // Limit body length
    
    return formatted;
  }
  
  /**
   * Parse classifier response
   */
  private parseClassification(jsonText: string): IntentClassification {
    try {
      // Clean up JSON (handle markdown code blocks)
      const cleanJson = jsonText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      
      const parsed = JSON.parse(cleanJson);
      
      return {
        intent: this.validateIntent(parsed.intent),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        secondaryIntent: parsed.secondaryIntent ? this.validateIntent(parsed.secondaryIntent) : null,
        secondaryConfidence: parsed.secondaryConfidence ? Math.max(0, Math.min(1, Number(parsed.secondaryConfidence))) : null,
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        requiresHumanReview: Boolean(parsed.requiresHumanReview),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        tokens: { input: 0, output: 0 }, // Set later
      };
    } catch (error) {
      logger.warn('[IntentClassifier] Failed to parse response', {
        jsonText: jsonText.slice(0, 200),
        error: (error as Error).message,
      });
      
      return {
        intent: 'unknown',
        confidence: 0,
        secondaryIntent: null,
        secondaryConfidence: null,
        suggestedActions: ['manual_review'],
        requiresHumanReview: true,
        reasoning: 'Failed to parse classifier response',
        tokens: { input: 0, output: 0 },
      };
    }
  }
  
  /**
   * Validate intent against known types
   */
  private validateIntent(intent: unknown): EmailIntent {
    const validIntents: EmailIntent[] = [
      'pricing_inquiry', 'technical_support', 'feature_request', 'bug_report',
      'partnership', 'documentation_help', 'getting_started', 'account_issue',
      'billing_question', 'general_inquiry', 'feedback', 'demo_request',
      'enterprise_inquiry', 'complaint', 'spam', 'unknown',
    ];
    
    if (typeof intent === 'string' && validIntents.includes(intent as EmailIntent)) {
      return intent as EmailIntent;
    }
    
    return 'unknown';
  }
  
  /**
   * Get suggested response type based on intent
   */
  getSuggestedResponseType(intent: EmailIntent): {
    autoRespondable: boolean;
    templateCategory: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    escalate: boolean;
  } {
    const config: Record<EmailIntent, {
      autoRespondable: boolean;
      templateCategory: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
      escalate: boolean;
    }> = {
      pricing_inquiry: { autoRespondable: true, templateCategory: 'pricing', priority: 'high', escalate: false },
      technical_support: { autoRespondable: false, templateCategory: 'support', priority: 'normal', escalate: false },
      feature_request: { autoRespondable: true, templateCategory: 'product', priority: 'low', escalate: false },
      bug_report: { autoRespondable: false, templateCategory: 'support', priority: 'high', escalate: true },
      partnership: { autoRespondable: false, templateCategory: 'business', priority: 'high', escalate: true },
      documentation_help: { autoRespondable: true, templateCategory: 'docs', priority: 'normal', escalate: false },
      getting_started: { autoRespondable: true, templateCategory: 'onboarding', priority: 'normal', escalate: false },
      account_issue: { autoRespondable: false, templateCategory: 'account', priority: 'high', escalate: false },
      billing_question: { autoRespondable: false, templateCategory: 'billing', priority: 'high', escalate: true },
      general_inquiry: { autoRespondable: true, templateCategory: 'general', priority: 'normal', escalate: false },
      feedback: { autoRespondable: true, templateCategory: 'feedback', priority: 'low', escalate: false },
      demo_request: { autoRespondable: true, templateCategory: 'sales', priority: 'high', escalate: true },
      enterprise_inquiry: { autoRespondable: false, templateCategory: 'enterprise', priority: 'urgent', escalate: true },
      complaint: { autoRespondable: false, templateCategory: 'support', priority: 'urgent', escalate: true },
      spam: { autoRespondable: false, templateCategory: 'spam', priority: 'low', escalate: false },
      unknown: { autoRespondable: false, templateCategory: 'general', priority: 'normal', escalate: false },
    };
    
    return config[intent];
  }
  
  /**
   * Check if intent should be auto-responded
   */
  canAutoRespond(classification: IntentClassification): boolean {
    const config = this.getSuggestedResponseType(classification.intent);
    
    return (
      config.autoRespondable &&
      classification.confidence >= this.thresholds.autoRespond &&
      !classification.requiresHumanReview &&
      classification.intent !== 'spam'
    );
  }
}

// Singleton
let classifierInstance: IntentClassifier | null = null;

export function getIntentClassifier(): IntentClassifier {
  if (!classifierInstance) {
    classifierInstance = new IntentClassifier();
  }
  return classifierInstance;
}

export default IntentClassifier;
