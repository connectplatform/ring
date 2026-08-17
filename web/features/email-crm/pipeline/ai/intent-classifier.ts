/**
 * Email Intent Classifier — OpenRouter DeepSeek primary, Haiku fallback
 */

import { completeEmailJson } from './email-llm'
import { logger } from '@/lib/logger'

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
  | 'newsletter_subscription'
  | 'vendor_offer_ring_relevant'
  | 'vendor_offer_irrelevant'
  | 'unknown'

export interface IntentClassification {
  intent: EmailIntent
  confidence: number
  secondaryIntent: EmailIntent | null
  secondaryConfidence: number | null
  suggestedActions: string[]
  requiresHumanReview: boolean
  reasoning: string
  tokens: { input: number; output: number }
  model?: string
  provider?: string
  providerLlmCallId?: string | null
}

const CLASSIFICATION_PROMPT = `You are an email classifier for Ring Platform (ringdom.org / ring-platform.org), an open-source B2B/Web3 collaboration platform (Next.js, multi-tenant rings, opportunities, store, wiki, news).

Classify the email intent into ONE of these categories:

- pricing_inquiry: Questions about pricing, plans, costs
- technical_support: Help with implementation, errors, debugging
- feature_request: Suggestions for new features
- bug_report: Reports of bugs, broken functionality
- partnership: Business partnership / collaboration proposals tied to Ring
- documentation_help: Questions about documentation
- getting_started: New users needing onboarding help
- account_issue: Login, password, account access problems
- billing_question: Payment, invoices, refunds
- general_inquiry: General questions not fitting other categories
- feedback: Positive or constructive feedback
- demo_request: Requests for product demos
- enterprise_inquiry: Enterprise/large-scale deployment questions
- complaint: Unhappy customer, formal complaint
- newsletter_subscription: Mailing-list / newsletter / marketing blast with unsubscribe
- vendor_offer_ring_relevant: Cold sales/offer that Ringdom could host or serve (marketplace listing, opportunity post, vendor onboarding, white-label ring, event on platform)
- vendor_offer_irrelevant: Cold sales/offer unrelated to Ringdom (SEO, generic SaaS spam, unrelated products)
- spam: Scams, phishing, pure junk (not a structured vendor pitch)
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
}`

const VALID_INTENTS: EmailIntent[] = [
  'pricing_inquiry',
  'technical_support',
  'feature_request',
  'bug_report',
  'partnership',
  'documentation_help',
  'getting_started',
  'account_issue',
  'billing_question',
  'general_inquiry',
  'feedback',
  'demo_request',
  'enterprise_inquiry',
  'complaint',
  'spam',
  'newsletter_subscription',
  'vendor_offer_ring_relevant',
  'vendor_offer_irrelevant',
  'unknown',
]

export class IntentClassifier {
  private thresholds = {
    autoRespond: 0.85,
    humanReview: 0.6,
    spamThreshold: 0.75,
  }

  async classify(emailContent: {
    subject: string
    body: string
    from: string
    fromName?: string
  }): Promise<IntentClassification> {
    const emailText = this.formatEmailForClassification(emailContent)

    try {
      const llm = await completeEmailJson({
        taskClass: 'email_intent',
        system: CLASSIFICATION_PROMPT,
        user: emailText,
        maxTokens: 350,
      })
      const classification = this.parseClassification(llm.text)
      classification.tokens = llm.tokens
      classification.model = llm.model
      classification.provider = llm.provider
      classification.providerLlmCallId = llm.providerLlmCallId

      if (classification.confidence < this.thresholds.humanReview) {
        classification.requiresHumanReview = true
      }

      logger.info('[IntentClassifier] Classification complete', {
        intent: classification.intent,
        confidence: classification.confidence,
        model: llm.model,
        provider: llm.provider,
      })
      return classification
    } catch (error) {
      logger.error('[IntentClassifier] Classification failed', {
        error: (error as Error).message,
      })
      return {
        intent: 'unknown',
        confidence: 0,
        secondaryIntent: null,
        secondaryConfidence: null,
        suggestedActions: ['manual_review'],
        requiresHumanReview: true,
        reasoning: 'Classification failed: ' + (error as Error).message,
        tokens: { input: 0, output: 0 },
      }
    }
  }

  private formatEmailForClassification(email: {
    subject: string
    body: string
    from: string
    fromName?: string
  }): string {
    let formatted = `From: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}\n`
    formatted += `Subject: ${email.subject}\n\n`
    formatted += `Body:\n${email.body.slice(0, 2000)}`
    return formatted
  }

  private parseClassification(jsonText: string): IntentClassification {
    try {
      const cleanJson = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      const parsed = JSON.parse(cleanJson)
      return {
        intent: this.validateIntent(parsed.intent),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        secondaryIntent: parsed.secondaryIntent ? this.validateIntent(parsed.secondaryIntent) : null,
        secondaryConfidence: parsed.secondaryConfidence
          ? Math.max(0, Math.min(1, Number(parsed.secondaryConfidence)))
          : null,
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        requiresHumanReview: Boolean(parsed.requiresHumanReview),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        tokens: { input: 0, output: 0 },
      }
    } catch {
      return {
        intent: 'unknown',
        confidence: 0,
        secondaryIntent: null,
        secondaryConfidence: null,
        suggestedActions: ['manual_review'],
        requiresHumanReview: true,
        reasoning: 'Failed to parse classifier response',
        tokens: { input: 0, output: 0 },
      }
    }
  }

  private validateIntent(intent: unknown): EmailIntent {
    if (typeof intent === 'string' && VALID_INTENTS.includes(intent as EmailIntent)) {
      return intent as EmailIntent
    }
    return 'unknown'
  }

  getSuggestedResponseType(intent: EmailIntent): {
    autoRespondable: boolean
    templateCategory: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    escalate: boolean
  } {
    const config: Record<
      EmailIntent,
      {
        autoRespondable: boolean
        templateCategory: string
        priority: 'low' | 'normal' | 'high' | 'urgent'
        escalate: boolean
      }
    > = {
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
      newsletter_subscription: { autoRespondable: false, templateCategory: 'spam', priority: 'low', escalate: false },
      vendor_offer_ring_relevant: {
        autoRespondable: false,
        templateCategory: 'business',
        priority: 'normal',
        escalate: false,
      },
      vendor_offer_irrelevant: { autoRespondable: false, templateCategory: 'spam', priority: 'low', escalate: false },
      unknown: { autoRespondable: false, templateCategory: 'general', priority: 'normal', escalate: false },
    }
    return config[intent]
  }

  canAutoRespond(classification: IntentClassification): boolean {
    const config = this.getSuggestedResponseType(classification.intent)
    return (
      config.autoRespondable &&
      classification.confidence >= this.thresholds.autoRespond &&
      !classification.requiresHumanReview &&
      classification.intent !== 'spam' &&
      classification.intent !== 'newsletter_subscription' &&
      classification.intent !== 'vendor_offer_irrelevant' &&
      classification.intent !== 'vendor_offer_ring_relevant'
    )
  }
}

let classifierInstance: IntentClassifier | null = null

export function getIntentClassifier(): IntentClassifier {
  if (!classifierInstance) classifierInstance = new IntentClassifier()
  return classifierInstance
}

export default IntentClassifier
