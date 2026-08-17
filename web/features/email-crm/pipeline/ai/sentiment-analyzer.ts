/**
 * Email Sentiment Analyzer — OpenRouter DeepSeek primary, Haiku fallback
 */

import { completeEmailJson } from './email-llm'
import { logger } from '@/lib/logger'

export type SentimentCategory =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'frustrated'
  | 'urgent'
  | 'confused'

export interface SentimentAnalysis {
  sentiment: SentimentCategory
  score: number
  confidence: number
  urgency: 'low' | 'normal' | 'high' | 'critical'
  emotionalTone: string[]
  customerSatisfaction: 'at_risk' | 'neutral' | 'satisfied'
  suggestedTone: string
  tokens: { input: number; output: number }
  model?: string
  provider?: string
  providerLlmCallId?: string | null
}

const SENTIMENT_PROMPT = `You are analyzing email sentiment for customer service at Ring Platform.

Analyze the emotional tone and urgency of this email.

Sentiment categories:
- positive: Happy, satisfied, grateful
- neutral: Factual, professional, no strong emotion  
- negative: Disappointed, unhappy
- frustrated: Annoyed, struggling, exasperated
- urgent: Time-sensitive, pressing need
- confused: Lost, unclear about something

Respond in JSON only:
{
  "sentiment": "category",
  "score": -1.0 to 1.0 (negative to positive),
  "confidence": 0.0-1.0,
  "urgency": "low|normal|high|critical",
  "emotionalTone": ["emotion1", "emotion2"],
  "customerSatisfaction": "at_risk|neutral|satisfied",
  "suggestedTone": "brief description of how to respond"
}`

export class SentimentAnalyzer {
  async analyze(email: { subject: string; body: string }): Promise<SentimentAnalysis> {
    const emailText = `Subject: ${email.subject}\n\n${email.body.slice(0, 2000)}`

    try {
      const llm = await completeEmailJson({
        taskClass: 'email_sentiment',
        system: SENTIMENT_PROMPT,
        user: emailText,
        maxTokens: 250,
      })
      const analysis = this.parseAnalysis(llm.text)
      analysis.tokens = llm.tokens
      analysis.model = llm.model
      analysis.provider = llm.provider
      analysis.providerLlmCallId = llm.providerLlmCallId

      logger.info('[SentimentAnalyzer] Analysis complete', {
        sentiment: analysis.sentiment,
        model: llm.model,
        provider: llm.provider,
      })
      return analysis
    } catch (error) {
      logger.error('[SentimentAnalyzer] Analysis failed', {
        error: (error as Error).message,
      })
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        urgency: 'normal',
        emotionalTone: [],
        customerSatisfaction: 'neutral',
        suggestedTone: 'Professional and helpful',
        tokens: { input: 0, output: 0 },
      }
    }
  }

  private parseAnalysis(jsonText: string): SentimentAnalysis {
    try {
      const cleanJson = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      const parsed = JSON.parse(cleanJson)
      return {
        sentiment: this.validateSentiment(parsed.sentiment),
        score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        urgency: this.validateUrgency(parsed.urgency),
        emotionalTone: Array.isArray(parsed.emotionalTone) ? parsed.emotionalTone : [],
        customerSatisfaction: this.validateSatisfaction(parsed.customerSatisfaction),
        suggestedTone: String(parsed.suggestedTone || 'Professional and helpful'),
        tokens: { input: 0, output: 0 },
      }
    } catch {
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        urgency: 'normal',
        emotionalTone: [],
        customerSatisfaction: 'neutral',
        suggestedTone: 'Professional and helpful',
        tokens: { input: 0, output: 0 },
      }
    }
  }

  private validateSentiment(sentiment: unknown): SentimentCategory {
    const valid: SentimentCategory[] = [
      'positive',
      'neutral',
      'negative',
      'frustrated',
      'urgent',
      'confused',
    ]
    if (typeof sentiment === 'string' && valid.includes(sentiment as SentimentCategory)) {
      return sentiment as SentimentCategory
    }
    return 'neutral'
  }

  private validateUrgency(urgency: unknown): 'low' | 'normal' | 'high' | 'critical' {
    const valid = ['low', 'normal', 'high', 'critical']
    if (typeof urgency === 'string' && valid.includes(urgency)) {
      return urgency as 'low' | 'normal' | 'high' | 'critical'
    }
    return 'normal'
  }

  private validateSatisfaction(sat: unknown): 'at_risk' | 'neutral' | 'satisfied' {
    const valid = ['at_risk', 'neutral', 'satisfied']
    if (typeof sat === 'string' && valid.includes(sat)) {
      return sat as 'at_risk' | 'neutral' | 'satisfied'
    }
    return 'neutral'
  }

  quickAnalyze(text: string): {
    sentiment: 'positive' | 'neutral' | 'negative'
    urgencyIndicators: boolean
  } {
    const lower = text.toLowerCase()
    const positiveWords = ['thank', 'great', 'awesome', 'love', 'excellent', 'appreciate', 'helpful']
    const negativeWords = [
      'problem',
      'issue',
      'broken',
      'not working',
      'frustrated',
      'disappointed',
      'wrong',
      'bug',
    ]
    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length
    const urgencyIndicators = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'deadline'].some(
      (w) => lower.includes(w)
    )
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
    if (positiveCount > negativeCount + 1) sentiment = 'positive'
    else if (negativeCount > positiveCount) sentiment = 'negative'
    return { sentiment, urgencyIndicators }
  }

  getPriorityFromSentiment(analysis: SentimentAnalysis): 'low' | 'normal' | 'high' | 'urgent' {
    if (analysis.urgency === 'critical') return 'urgent'
    if (analysis.customerSatisfaction === 'at_risk') return 'high'
    if (analysis.urgency === 'high' || analysis.sentiment === 'frustrated') return 'high'
    if (analysis.sentiment === 'negative') return 'normal'
    return analysis.urgency === 'low' ? 'low' : 'normal'
  }
}

let analyzerInstance: SentimentAnalyzer | null = null

export function getSentimentAnalyzer(): SentimentAnalyzer {
  if (!analyzerInstance) analyzerInstance = new SentimentAnalyzer()
  return analyzerInstance
}

export default SentimentAnalyzer
