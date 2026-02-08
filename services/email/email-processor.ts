/**
 * Email Processing Orchestrator
 * =============================
 * Main orchestrator that coordinates all email processing services
 * Reference: Email Automation Specialist skillset
 */

import { EventEmitter } from 'events';
import { ImapListener, getImapListener, EmailReceivedEvent } from './imap';
import { EmailParser, getEmailParser, ParsedEmail } from './parser';
import { SecurityPipeline, getSecurityPipeline, SecurityCheckResult } from './security';
import { 
  IntentClassifier, getIntentClassifier, IntentClassification,
  SentimentAnalyzer, getSentimentAnalyzer, SentimentAnalysis,
  ContextBuilder, getContextBuilder, EmailContext,
  ResponseGenerator, getResponseGenerator, ResponseGenerationResult,
  CostTracker, getCostTracker
} from './ai';
import { 
  EmailContactService, getEmailContactService, EmailContact,
  EmailTaskService, getEmailTaskService
} from './crm';
import { EmailDraftService, getEmailDraftService, DraftApprovalResult } from './drafts';
import { logger } from '@/lib/logger';

export interface ProcessedEmail {
  // Raw input
  rawEvent: EmailReceivedEvent;
  
  // Parsed content
  parsed: ParsedEmail;
  
  // Security check
  security: SecurityCheckResult;
  
  // AI analysis
  intent: IntentClassification;
  sentiment: SentimentAnalysis;
  context: EmailContext;
  
  // CRM data
  contact: EmailContact;
  
  // Generated response
  generation?: ResponseGenerationResult;
  draftResult?: DraftApprovalResult;
  
  // Metadata
  processingTime: {
    total: number;
    parsing: number;
    security: number;
    analysis: number;
    generation: number;
  };
  blocked: boolean;
  autoSent: boolean;
}

export interface ProcessorEvents {
  'email:received': (event: EmailReceivedEvent) => void;
  'email:parsed': (parsed: ParsedEmail) => void;
  'email:blocked': (result: { parsed: ParsedEmail; security: SecurityCheckResult }) => void;
  'email:analyzed': (result: { parsed: ParsedEmail; intent: IntentClassification; sentiment: SentimentAnalysis }) => void;
  'email:processed': (result: ProcessedEmail) => void;
  'draft:created': (result: DraftApprovalResult) => void;
  'draft:auto_sent': (result: { draft: DraftApprovalResult; messageId: string }) => void;
  'task:created': (task: { threadId: string; title: string; taskType: string }) => void;
  'error': (error: Error) => void;
}

export class EmailProcessor extends EventEmitter {
  // Services
  private imapListener: ImapListener;
  private parser: EmailParser;
  private securityPipeline: SecurityPipeline;
  private intentClassifier: IntentClassifier;
  private sentimentAnalyzer: SentimentAnalyzer;
  private contextBuilder: ContextBuilder;
  private responseGenerator: ResponseGenerator;
  private costTracker: CostTracker;
  private contactService: EmailContactService;
  private taskService: EmailTaskService;
  private draftService: EmailDraftService;
  
  // State
  private isRunning = false;
  private processedCount = 0;
  
  // Configuration
  private config = {
    generateResponses: true, // Generate AI responses
    autoSendEnabled: true, // Allow auto-sending
    blockOnSecurityFail: true, // Block processing if security fails
    createTasks: true, // Auto-create tasks
    trackCosts: true, // Track API costs
  };
  
  constructor() {
    super();
    
    // Initialize services
    this.imapListener = getImapListener();
    this.parser = getEmailParser();
    this.securityPipeline = getSecurityPipeline();
    this.intentClassifier = getIntentClassifier();
    this.sentimentAnalyzer = getSentimentAnalyzer();
    this.contextBuilder = getContextBuilder();
    this.responseGenerator = getResponseGenerator();
    this.costTracker = getCostTracker();
    this.contactService = getEmailContactService();
    this.taskService = getEmailTaskService();
    this.draftService = getEmailDraftService();
  }
  
  /**
   * Start processing emails
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[EmailProcessor] Already running');
      return;
    }
    
    this.isRunning = true;
    
    // Set up IMAP listener events
    this.imapListener.on('email', (event) => this.handleEmail(event));
    this.imapListener.on('error', (error) => this.emit('error', error));
    
    // Start IMAP listener
    await this.imapListener.start();
    
    logger.info('[EmailProcessor] Started');
  }
  
  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.imapListener.stop();
    
    logger.info('[EmailProcessor] Stopped', {
      processedCount: this.processedCount,
    });
  }
  
  /**
   * Handle incoming email
   */
  private async handleEmail(event: EmailReceivedEvent): Promise<void> {
    const startTime = Date.now();
    const timing = {
      total: 0,
      parsing: 0,
      security: 0,
      analysis: 0,
      generation: 0,
    };
    
    logger.info('[EmailProcessor] Processing email', {
      messageId: event.messageId,
      from: event.from,
      subject: event.subject,
    });
    
    this.emit('email:received', event);
    
    try {
      // Step 1: Parse email
      const parseStart = Date.now();
      const parsed = await this.parser.parseFromEvent(event);
      timing.parsing = Date.now() - parseStart;
      
      this.emit('email:parsed', parsed);
      
      // Step 2: Security check
      const securityStart = Date.now();
      const security = await this.securityPipeline.checkInbound({
        subject: parsed.subject,
        from: parsed.from.email,
        fromName: parsed.from.name || undefined,
        body: parsed.bodyTextClean,
        attachmentNames: parsed.attachments.map(a => a.filename),
      });
      timing.security = Date.now() - securityStart;
      
      // Block if security fails (configurable)
      if (security.blocked && this.config.blockOnSecurityFail) {
        logger.warn('[EmailProcessor] Email blocked by security', {
          messageId: event.messageId,
          riskLevel: security.riskLevel,
          riskScore: security.totalRiskScore,
        });
        
        this.emit('email:blocked', { parsed, security });
        
        // Mark as seen but don't process further
        await this.imapListener.markAsSeen(event.uid);
        return;
      }
      
      // Step 3: AI Analysis
      const analysisStart = Date.now();
      
      // Run intent and sentiment analysis in parallel
      const [intent, sentiment] = await Promise.all([
        this.intentClassifier.classify({
          subject: parsed.subject,
          body: parsed.bodyTextClean,
          from: parsed.from.email,
          fromName: parsed.from.name || undefined,
        }),
        this.sentimentAnalyzer.analyze({
          subject: parsed.subject,
          body: parsed.bodyTextClean,
        }),
      ]);
      
      timing.analysis = Date.now() - analysisStart;
      
      this.emit('email:analyzed', { parsed, intent, sentiment });
      
      // Track analysis costs
      if (this.config.trackCosts) {
        await this.costTracker.recordUsage({
          emailId: event.messageId,
          model: 'claude-haiku-4-5-20250514',
          operation: 'intent_classification',
          inputTokens: intent.tokens.input,
          outputTokens: intent.tokens.output,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          latencyMs: timing.analysis,
          success: true,
          errorMessage: null,
        });
        
        await this.costTracker.recordUsage({
          emailId: event.messageId,
          model: 'claude-haiku-4-5-20250514',
          operation: 'sentiment_analysis',
          inputTokens: sentiment.tokens.input,
          outputTokens: sentiment.tokens.output,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          latencyMs: timing.analysis,
          success: true,
          errorMessage: null,
        });
      }
      
      // Step 4: Get/create contact
      const contact = await this.contactService.getOrCreateContact(
        parsed.from.email,
        {
          name: parsed.from.name || undefined,
        }
      );
      
      // Record sentiment for contact
      await this.contactService.recordSentiment(
        contact.id,
        sentiment.sentiment,
        sentiment.score
      );
      
      // Step 5: Build context
      const context = await this.contextBuilder.buildContext(
        parsed,
        intent,
        sentiment,
        {
          contactData: {
            name: contact.name,
            company: contact.company,
            type: contact.type,
            totalInteractions: contact.totalInteractions,
            firstContact: contact.firstContact,
            sentimentHistory: contact.sentimentHistory,
            ringUserId: contact.ringUserId,
          },
        }
      );
      
      // Step 6: Create tasks if enabled
      if (this.config.createTasks) {
        const tasks = await this.taskService.autoCreateTasks({
          threadId: event.messageId, // Using message ID as thread ID for now
          messageId: event.messageId,
          senderEmail: parsed.from.email,
          senderName: parsed.from.name,
          senderCompany: contact.company,
          subject: parsed.subject,
          intent: intent.intent,
          sentiment: sentiment.sentiment,
          priority: context.guidance.priorityLevel,
          isFirstContact: contact.totalInteractions === 1,
          hasAttachments: parsed.hasAttachments,
        });
        
        for (const task of tasks) {
          this.emit('task:created', {
            threadId: task.threadId,
            title: task.title,
            taskType: task.taskType,
          });
        }
      }
      
      // Step 7: Generate response if enabled and not spam
      let generation: ResponseGenerationResult | undefined;
      let draftResult: DraftApprovalResult | undefined;
      
      if (this.config.generateResponses && intent.intent !== 'spam') {
        const genStart = Date.now();
        
        generation = await this.responseGenerator.generate(
          context,
          security,
          {
            enableCaching: true,
            useTools: true,
          }
        );
        
        timing.generation = Date.now() - genStart;
        
        // Track generation cost
        if (this.config.trackCosts) {
          await this.costTracker.recordUsage({
            emailId: event.messageId,
            model: generation.modelUsed,
            operation: 'response_generation',
            inputTokens: generation.tokens.input,
            outputTokens: generation.tokens.output,
            cacheReadTokens: generation.tokens.cacheRead,
            cacheWriteTokens: generation.tokens.cacheWrite,
            latencyMs: timing.generation,
            success: true,
            errorMessage: null,
          });
        }
        
        // Create draft
        draftResult = await this.draftService.createFromGeneration(
          event.messageId,
          event.messageId, // Thread ID
          generation,
          {
            intent: intent.intent,
            priority: context.guidance.priorityLevel,
            isNewContact: contact.totalInteractions === 1,
            securityPassed: generation.securityCheck.passed,
          }
        );
        
        this.emit('draft:created', draftResult);
        
        // Handle auto-send if enabled
        if (this.config.autoSendEnabled && draftResult.shouldAutoSend) {
          // In production, this would send the email
          const sentMessageId = `sent_${Date.now()}`;
          await this.draftService.markSent(draftResult.draft.id, sentMessageId, true);
          
          logger.info('[EmailProcessor] Auto-sent response', {
            draftId: draftResult.draft.id,
            confidence: generation.confidenceScore,
          });
          
          this.emit('draft:auto_sent', {
            draft: draftResult,
            messageId: sentMessageId,
          });
        }
      }
      
      // Mark email as seen
      await this.imapListener.markAsSeen(event.uid);
      
      // Calculate total time
      timing.total = Date.now() - startTime;
      
      // Emit processed event
      const result: ProcessedEmail = {
        rawEvent: event,
        parsed,
        security,
        intent,
        sentiment,
        context,
        contact,
        generation,
        draftResult,
        processingTime: timing,
        blocked: false,
        autoSent: draftResult?.shouldAutoSend || false,
      };
      
      this.emit('email:processed', result);
      this.processedCount++;
      
      logger.info('[EmailProcessor] Email processed', {
        messageId: event.messageId,
        intent: intent.intent,
        sentiment: sentiment.sentiment,
        autoSent: result.autoSent,
        totalTimeMs: timing.total,
      });
    } catch (error) {
      logger.error('[EmailProcessor] Processing failed', {
        messageId: event.messageId,
        error: (error as Error).message,
      });
      
      this.emit('error', error as Error);
    }
  }
  
  /**
   * Process a single email manually (for testing/backfill)
   */
  async processEmail(event: EmailReceivedEvent): Promise<ProcessedEmail | null> {
    return new Promise((resolve, reject) => {
      const handler = (result: ProcessedEmail) => {
        if (result.rawEvent.messageId === event.messageId) {
          this.off('email:processed', handler);
          this.off('email:blocked', blockHandler);
          resolve(result);
        }
      };
      
      const blockHandler = (result: { parsed: ParsedEmail; security: SecurityCheckResult }) => {
        if (result.parsed.messageId === event.messageId) {
          this.off('email:processed', handler);
          this.off('email:blocked', blockHandler);
          resolve(null);
        }
      };
      
      this.on('email:processed', handler);
      this.on('email:blocked', blockHandler);
      
      this.handleEmail(event).catch(reject);
    });
  }
  
  /**
   * Get processing statistics
   */
  getStats(): {
    processedCount: number;
    isRunning: boolean;
    imapConnected: boolean;
  } {
    return {
      processedCount: this.processedCount,
      isRunning: this.isRunning,
      imapConnected: this.imapListener.isConnected(),
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
    
    logger.info('[EmailProcessor] Config updated', this.config);
  }
}

// Singleton
let processorInstance: EmailProcessor | null = null;

export function getEmailProcessor(): EmailProcessor {
  if (!processorInstance) {
    processorInstance = new EmailProcessor();
  }
  return processorInstance;
}

export default EmailProcessor;
