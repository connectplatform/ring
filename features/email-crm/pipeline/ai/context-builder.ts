/**
 * Email Context Builder
 * =====================
 * Builds rich context for AI response generation
 * Combines email data, contact history, and knowledge base
 * Reference: Email Automation Specialist skillset
 */

import { ParsedEmail } from '../parser/email-parser';
import { IntentClassification } from './intent-classifier';
import { SentimentAnalysis } from './sentiment-analyzer';
import { logger } from '@/lib/logger';

export interface EmailContext {
  // Current email
  email: {
    subject: string;
    from: string;
    fromName: string | null;
    body: string;
    bodyClean: string;
    date: Date;
    isReply: boolean;
    hasAttachments: boolean;
    attachmentNames: string[];
  };
  
  // AI analysis
  analysis: {
    intent: IntentClassification;
    sentiment: SentimentAnalysis;
  };
  
  // Thread context
  thread: {
    messageCount: number;
    previousMessages: ThreadMessage[];
    daysActive: number;
    hasBeenResolved: boolean;
    previousResolution: string | null;
  } | null;
  
  // Contact context
  contact: {
    name: string | null;
    email: string;
    company: string | null;
    type: string | null;
    totalInteractions: number;
    daysSinceFirstContact: number;
    sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown';
    isKnownUser: boolean; // Has Ring Platform account
    ringUserId: string | null;
  } | null;
  
  // Knowledge base context
  knowledge: {
    relevantArticles: KnowledgeArticle[];
    suggestedTemplates: ResponseTemplate[];
    relatedFAQs: FAQ[];
  };
  
  // Response guidance
  guidance: {
    suggestedTone: string;
    priorityLevel: 'low' | 'normal' | 'high' | 'urgent';
    canAutoRespond: boolean;
    requiresHumanReview: boolean;
    escalationNeeded: boolean;
    suggestedActions: string[];
  };
}

export interface ThreadMessage {
  messageId: string;
  from: string;
  isInbound: boolean;
  subject: string;
  bodyPreview: string; // First 500 chars
  date: Date;
  sentiment: string | null;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  relevanceScore: number;
}

export interface ResponseTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  useCase: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export class ContextBuilder {
  /**
   * Build full context for response generation
   */
  async buildContext(
    parsedEmail: ParsedEmail,
    intent: IntentClassification,
    sentiment: SentimentAnalysis,
    options: {
      threadData?: ThreadMessage[];
      contactData?: {
        name: string | null;
        company: string | null;
        type: string | null;
        totalInteractions: number;
        firstContact: Date;
        sentimentHistory: Array<{ sentiment: string; timestamp: Date }>;
        ringUserId: string | null;
      };
      knowledgeArticles?: KnowledgeArticle[];
      templates?: ResponseTemplate[];
      faqs?: FAQ[];
    } = {}
  ): Promise<EmailContext> {
    
    // Build email context
    const emailContext = {
      subject: parsedEmail.subject,
      from: parsedEmail.from.email,
      fromName: parsedEmail.from.name,
      body: parsedEmail.bodyText || '',
      bodyClean: parsedEmail.bodyTextClean,
      date: parsedEmail.date,
      isReply: parsedEmail.isReply,
      hasAttachments: parsedEmail.hasAttachments,
      attachmentNames: parsedEmail.attachments.map(a => a.filename),
    };
    
    // Build thread context
    let threadContext: EmailContext['thread'] = null;
    if (options.threadData && options.threadData.length > 0) {
      const oldestDate = new Date(Math.min(...options.threadData.map(m => m.date.getTime())));
      const daysActive = Math.ceil((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      
      threadContext = {
        messageCount: options.threadData.length,
        previousMessages: options.threadData.slice(-5), // Last 5 messages
        daysActive,
        hasBeenResolved: false, // Would check thread status
        previousResolution: null,
      };
    }
    
    // Build contact context
    let contactContext: EmailContext['contact'] = null;
    if (options.contactData) {
      const daysSinceFirstContact = Math.ceil(
        (Date.now() - options.contactData.firstContact.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      contactContext = {
        name: options.contactData.name,
        email: parsedEmail.from.email,
        company: options.contactData.company,
        type: options.contactData.type,
        totalInteractions: options.contactData.totalInteractions,
        daysSinceFirstContact,
        sentimentTrend: this.calculateSentimentTrend(options.contactData.sentimentHistory),
        isKnownUser: !!options.contactData.ringUserId,
        ringUserId: options.contactData.ringUserId,
      };
    }
    
    // Build knowledge context
    const knowledgeContext = {
      relevantArticles: options.knowledgeArticles || [],
      suggestedTemplates: this.filterTemplatesByIntent(options.templates || [], intent.intent),
      relatedFAQs: options.faqs || [],
    };
    
    // Build guidance
    const guidance = this.buildGuidance(intent, sentiment, contactContext);
    
    const context: EmailContext = {
      email: emailContext,
      analysis: {
        intent,
        sentiment,
      },
      thread: threadContext,
      contact: contactContext,
      knowledge: knowledgeContext,
      guidance,
    };
    
    logger.info('[ContextBuilder] Context built', {
      hasThread: !!threadContext,
      threadMessageCount: threadContext?.messageCount || 0,
      hasContact: !!contactContext,
      contactInteractions: contactContext?.totalInteractions || 0,
      knowledgeArticles: knowledgeContext.relevantArticles.length,
      canAutoRespond: guidance.canAutoRespond,
    });
    
    return context;
  }
  
  /**
   * Calculate sentiment trend from history
   */
  private calculateSentimentTrend(
    history: Array<{ sentiment: string; timestamp: Date }>
  ): 'improving' | 'stable' | 'declining' | 'unknown' {
    if (history.length < 3) return 'unknown';
    
    // Score each sentiment
    const scores: Record<string, number> = {
      positive: 1,
      neutral: 0,
      negative: -1,
      frustrated: -2,
      urgent: -0.5,
      confused: -0.5,
    };
    
    // Get recent vs older sentiment averages
    const sorted = [...history].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const recentCount = Math.ceil(sorted.length / 2);
    const recent = sorted.slice(0, recentCount);
    const older = sorted.slice(recentCount);
    
    const avgRecent = recent.reduce((sum, h) => sum + (scores[h.sentiment] || 0), 0) / recent.length;
    const avgOlder = older.reduce((sum, h) => sum + (scores[h.sentiment] || 0), 0) / older.length;
    
    const diff = avgRecent - avgOlder;
    
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }
  
  /**
   * Filter templates by intent
   */
  private filterTemplatesByIntent(
    templates: ResponseTemplate[],
    intent: string
  ): ResponseTemplate[] {
    // Map intents to template categories
    const intentToCategory: Record<string, string[]> = {
      pricing_inquiry: ['pricing', 'sales'],
      technical_support: ['support', 'technical'],
      feature_request: ['product', 'feedback'],
      bug_report: ['support', 'technical'],
      partnership: ['business', 'partnership'],
      documentation_help: ['docs', 'technical'],
      getting_started: ['onboarding', 'docs'],
      account_issue: ['account', 'support'],
      billing_question: ['billing', 'support'],
      general_inquiry: ['general'],
      feedback: ['feedback', 'general'],
      demo_request: ['sales', 'demo'],
      enterprise_inquiry: ['enterprise', 'sales'],
      complaint: ['support', 'escalation'],
    };
    
    const categories = intentToCategory[intent] || ['general'];
    
    return templates.filter(t => 
      categories.some(c => t.category.toLowerCase().includes(c))
    ).slice(0, 3); // Max 3 templates
  }
  
  /**
   * Build response guidance
   */
  private buildGuidance(
    intent: IntentClassification,
    sentiment: SentimentAnalysis,
    contact: EmailContext['contact'] | null
  ): EmailContext['guidance'] {
    // Determine if can auto-respond
    const canAutoRespond = 
      intent.confidence >= 0.85 &&
      !intent.requiresHumanReview &&
      sentiment.sentiment !== 'frustrated' &&
      sentiment.customerSatisfaction !== 'at_risk' &&
      !['complaint', 'billing_question', 'enterprise_inquiry', 'partnership'].includes(intent.intent);
    
    // Determine priority
    let priorityLevel: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    if (sentiment.urgency === 'critical' || intent.intent === 'complaint') {
      priorityLevel = 'urgent';
    } else if (
      sentiment.urgency === 'high' ||
      sentiment.customerSatisfaction === 'at_risk' ||
      ['billing_question', 'enterprise_inquiry'].includes(intent.intent)
    ) {
      priorityLevel = 'high';
    } else if (intent.intent === 'feature_request' || intent.intent === 'feedback') {
      priorityLevel = 'low';
    }
    
    // Determine if escalation needed
    const escalationNeeded = 
      priorityLevel === 'urgent' ||
      ['complaint', 'partnership', 'enterprise_inquiry'].includes(intent.intent) ||
      (contact?.sentimentTrend === 'declining' && contact.totalInteractions > 3);
    
    return {
      suggestedTone: sentiment.suggestedTone,
      priorityLevel,
      canAutoRespond,
      requiresHumanReview: !canAutoRespond || intent.requiresHumanReview,
      escalationNeeded,
      suggestedActions: intent.suggestedActions,
    };
  }
  
  /**
   * Format context for AI prompt
   */
  formatForPrompt(context: EmailContext): string {
    let formatted = '';
    
    // Contact info
    if (context.contact) {
      formatted += `CONTACT INFO:\n`;
      formatted += `- Name: ${context.contact.name || 'Unknown'}\n`;
      formatted += `- Company: ${context.contact.company || 'Unknown'}\n`;
      formatted += `- Type: ${context.contact.type || 'Unknown'}\n`;
      formatted += `- Previous interactions: ${context.contact.totalInteractions}\n`;
      formatted += `- Sentiment trend: ${context.contact.sentimentTrend}\n`;
      formatted += `- Ring Platform user: ${context.contact.isKnownUser ? 'Yes' : 'No'}\n\n`;
    }
    
    // Thread history
    if (context.thread && context.thread.previousMessages.length > 0) {
      formatted += `CONVERSATION HISTORY (${context.thread.messageCount} messages):\n`;
      for (const msg of context.thread.previousMessages) {
        const direction = msg.isInbound ? 'Customer' : 'Us';
        formatted += `[${msg.date.toISOString().split('T')[0]}] ${direction}: ${msg.bodyPreview}\n`;
      }
      formatted += `\n`;
    }
    
    // Current analysis
    formatted += `ANALYSIS:\n`;
    formatted += `- Intent: ${context.analysis.intent.intent} (${Math.round(context.analysis.intent.confidence * 100)}% confidence)\n`;
    formatted += `- Sentiment: ${context.analysis.sentiment.sentiment} (score: ${context.analysis.sentiment.score})\n`;
    formatted += `- Urgency: ${context.analysis.sentiment.urgency}\n`;
    formatted += `- Suggested tone: ${context.guidance.suggestedTone}\n\n`;
    
    // Relevant knowledge
    if (context.knowledge.relevantArticles.length > 0) {
      formatted += `RELEVANT KNOWLEDGE:\n`;
      for (const article of context.knowledge.relevantArticles.slice(0, 3)) {
        formatted += `- ${article.title}: ${article.content.slice(0, 200)}...\n`;
      }
      formatted += `\n`;
    }
    
    return formatted;
  }
}

// Singleton
let builderInstance: ContextBuilder | null = null;

export function getContextBuilder(): ContextBuilder {
  if (!builderInstance) {
    builderInstance = new ContextBuilder();
  }
  return builderInstance;
}

export default ContextBuilder;
