/**
 * Email Sentiment Analyzer
 * ========================
 * Analyzes emotional tone and urgency of incoming emails
 * Reference: Email Automation Specialist skillset
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

export type SentimentCategory = 
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'frustrated'
  | 'urgent'
  | 'confused';

export interface SentimentAnalysis {
  sentiment: SentimentCategory;
  score: number; // -1 (very negative) to +1 (very positive)
  confidence: number; // 0-1
  urgency: 'low' | 'normal' | 'high' | 'critical';
  emotionalTone: string[]; // e.g., ['frustrated', 'disappointed']
  customerSatisfaction: 'at_risk' | 'neutral' | 'satisfied';
  suggestedTone: string; // For response generation
  tokens: {
    input: number;
    output: number;
  };
}

// Analysis prompt
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
}`;

export class SentimentAnalyzer {
  private anthropic: Anthropic;
  private model = 'claude-haiku-4-5-20250514';
  
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  /**
   * Analyze email sentiment
   */
  async analyze(email: {
    subject: string;
    body: string;
  }): Promise<SentimentAnalysis> {
    const emailText = `Subject: ${email.subject}\n\n${email.body.slice(0, 2000)}`;
    
    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 250,
        system: SENTIMENT_PROMPT,
        messages: [
          {
            role: 'user',
            content: emailText,
          },
          // JSON prefill
          {
            role: 'assistant',
            content: '{',
          },
        ],
      });
      
      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      
      const jsonText = '{' + textContent.text;
      const analysis = this.parseAnalysis(jsonText);
      
      analysis.tokens = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
      
      logger.info('[SentimentAnalyzer] Analysis complete', {
        sentiment: analysis.sentiment,
        score: analysis.score,
        urgency: analysis.urgency,
        customerSatisfaction: analysis.customerSatisfaction,
      });
      
      return analysis;
    } catch (error) {
      logger.error('[SentimentAnalyzer] Analysis failed', {
        error: (error as Error).message,
      });
      
      // Return neutral on failure
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        urgency: 'normal',
        emotionalTone: [],
        customerSatisfaction: 'neutral',
        suggestedTone: 'Professional and helpful',
        tokens: { input: 0, output: 0 },
      };
    }
  }
  
  /**
   * Parse analyzer response
   */
  private parseAnalysis(jsonText: string): SentimentAnalysis {
    try {
      const cleanJson = jsonText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      
      const parsed = JSON.parse(cleanJson);
      
      return {
        sentiment: this.validateSentiment(parsed.sentiment),
        score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        urgency: this.validateUrgency(parsed.urgency),
        emotionalTone: Array.isArray(parsed.emotionalTone) ? parsed.emotionalTone : [],
        customerSatisfaction: this.validateSatisfaction(parsed.customerSatisfaction),
        suggestedTone: String(parsed.suggestedTone || 'Professional and helpful'),
        tokens: { input: 0, output: 0 },
      };
    } catch (error) {
      logger.warn('[SentimentAnalyzer] Failed to parse response', {
        error: (error as Error).message,
      });
      
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        urgency: 'normal',
        emotionalTone: [],
        customerSatisfaction: 'neutral',
        suggestedTone: 'Professional and helpful',
        tokens: { input: 0, output: 0 },
      };
    }
  }
  
  /**
   * Validate sentiment category
   */
  private validateSentiment(sentiment: unknown): SentimentCategory {
    const valid: SentimentCategory[] = [
      'positive', 'neutral', 'negative', 'frustrated', 'urgent', 'confused',
    ];
    
    if (typeof sentiment === 'string' && valid.includes(sentiment as SentimentCategory)) {
      return sentiment as SentimentCategory;
    }
    
    return 'neutral';
  }
  
  /**
   * Validate urgency level
   */
  private validateUrgency(urgency: unknown): 'low' | 'normal' | 'high' | 'critical' {
    const valid = ['low', 'normal', 'high', 'critical'];
    
    if (typeof urgency === 'string' && valid.includes(urgency)) {
      return urgency as 'low' | 'normal' | 'high' | 'critical';
    }
    
    return 'normal';
  }
  
  /**
   * Validate customer satisfaction
   */
  private validateSatisfaction(sat: unknown): 'at_risk' | 'neutral' | 'satisfied' {
    const valid = ['at_risk', 'neutral', 'satisfied'];
    
    if (typeof sat === 'string' && valid.includes(sat)) {
      return sat as 'at_risk' | 'neutral' | 'satisfied';
    }
    
    return 'neutral';
  }
  
  /**
   * Quick heuristic sentiment check (no API call)
   */
  quickAnalyze(text: string): {
    sentiment: 'positive' | 'neutral' | 'negative';
    urgencyIndicators: boolean;
  } {
    const lower = text.toLowerCase();
    
    // Positive indicators
    const positiveWords = ['thank', 'great', 'awesome', 'love', 'excellent', 'appreciate', 'helpful'];
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    
    // Negative indicators
    const negativeWords = ['problem', 'issue', 'broken', 'not working', 'frustrated', 'disappointed', 'wrong', 'bug'];
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;
    
    // Urgency indicators
    const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'deadline'];
    const urgencyIndicators = urgentWords.some(w => lower.includes(w));
    
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount + 1) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
    }
    
    return { sentiment, urgencyIndicators };
  }
  
  /**
   * Determine response priority based on sentiment
   */
  getPriorityFromSentiment(analysis: SentimentAnalysis): 'low' | 'normal' | 'high' | 'urgent' {
    // Critical urgency always urgent
    if (analysis.urgency === 'critical') return 'urgent';
    
    // At-risk customers are high priority
    if (analysis.customerSatisfaction === 'at_risk') return 'high';
    
    // High urgency or frustrated sentiment
    if (analysis.urgency === 'high' || analysis.sentiment === 'frustrated') return 'high';
    
    // Negative sentiment
    if (analysis.sentiment === 'negative') return 'normal';
    
    // Default based on urgency
    return analysis.urgency === 'low' ? 'low' : 'normal';
  }
}

// Singleton
let analyzerInstance: SentimentAnalyzer | null = null;

export function getSentimentAnalyzer(): SentimentAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SentimentAnalyzer();
  }
  return analyzerInstance;
}

export default SentimentAnalyzer;
