/**
 * Email Processing Orchestrator
 * =============================
 * Main orchestrator that coordinates all email processing services
 * Reference: Email Automation Specialist skillset
 */

import { EventEmitter } from 'events';
import { ImapListener, getImapListener, EmailReceivedEvent } from './imap'
import {
  loadCrmChannels,
  type ChannelFlow,
} from './imap/config'
import { EmailParser, getEmailParser, ParsedEmail } from './parser';
import { SecurityPipeline, getSecurityPipeline, SecurityCheckResult } from './security';
import { 
  IntentClassifier, getIntentClassifier, IntentClassification,
  SentimentAnalyzer, getSentimentAnalyzer, SentimentAnalysis,
  ContextBuilder, getContextBuilder, EmailContext,
  ResponseGenerator, getResponseGenerator, ResponseGenerationResult,
  CostTracker, getCostTracker
} from './ai';
import { routeCrmOps, type CrmOpsRouteResult } from './ai/crm-ops-router';
import { 
  EmailContactService, getEmailContactService, EmailContact,
  EmailTaskService, getEmailTaskService, EmailTask,
} from './crm';
import { EmailDraftService, getEmailDraftService, DraftApprovalResult } from './drafts';
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service';
import { EmailMessageService } from '@/features/email-crm/services/email-message-service';
import { EmailApiUsageService } from '@/features/email-crm/services/email-api-usage-service';
import { sendDraftReply } from '@/features/email-crm/services/email-send-orchestrator';
import { extractThreadMarker, RING_THREAD_HEADER } from '@/features/email-crm/lib/thread-marker';
import { wireEmailNotifications } from './wire-email-notifications';
import { logger } from '@/lib/logger';

let pollInFlight = false;

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
  crmOps?: CrmOpsRouteResult;
  
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
  'task:created': (task: EmailTask) => void;
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
  /** Consecutive pre-persist failures keyed by IMAP uid (or messageId). */
  private prePersistFailCounts = new Map<string, number>();
  private static readonly QUARANTINE_FOLDER =
    process.env.EMAIL_CRM_QUARANTINE_FOLDER || 'CRM.Quarantine';
  private static readonly QUARANTINE_AFTER = Math.max(
    1,
    parseInt(process.env.EMAIL_CRM_QUARANTINE_AFTER || '3', 10) || 3,
  );
  
  // Configuration
  private config = {
    generateResponses: true,
    autoSendEnabled: process.env.EMAIL_AUTO_SEND_ENABLED === 'true',
    blockOnSecurityFail: true,
    createTasks: true,
    trackCosts: true,
  };
  
  constructor() {
    super();
    
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

    this.costTracker.setPersistenceCallback((record) => EmailApiUsageService.save(record));
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
  
  /** Cron-safe one-shot IMAP poll across all enabled CRM channels (no IDLE). */
  async pollInboundBatch(): Promise<{
    processed: number
    failed: number
    skipped?: boolean
    channels?: Array<{
      channelId: string
      channelName: string
      processed: number
      failed: number
      error?: string
    }>
  }> {
    if (pollInFlight) {
      logger.warn('[EmailProcessor] Poll skipped — already in flight')
      return { processed: 0, failed: 0, skipped: true }
    }
    if (this.isRunning) {
      logger.warn('[EmailProcessor] Poll skipped — IDLE listener active')
      return { processed: 0, failed: 0, skipped: true }
    }

    pollInFlight = true
    try {
      const channels = loadCrmChannels()
      const channelResults: Array<{
        channelId: string
        channelName: string
        processed: number
        failed: number
        error?: string
      }> = []
      let processed = 0
      let failed = 0

      for (const channel of channels) {
        try {
          const listener = new ImapListener(channel.config)
          const result = await listener.pollBatch((event) =>
            this.handleEmail(
              {
                ...event,
                channelId: channel.id,
                channelName: channel.name,
                flow: channel.flow,
              },
              { skipMarkSeen: false, imapListener: listener },
            ),
          )
          const chProcessed = result.queued - result.failed
          const chFailed = result.failed
          processed += chProcessed
          failed += chFailed
          channelResults.push({
            channelId: channel.id,
            channelName: channel.name,
            processed: chProcessed,
            failed: chFailed,
          })
        } catch (err) {
          const message = (err as Error).message
          logger.error('[EmailProcessor] Channel poll failed', {
            channelId: channel.id,
            error: message,
          })
          failed++
          channelResults.push({
            channelId: channel.id,
            channelName: channel.name,
            processed: 0,
            failed: 1,
            error: message,
          })
        }
      }

      return { processed, failed, channels: channelResults }
    } finally {
      pollInFlight = false
    }
  }

  /** Ingest a single event (webhook / manual). uid=0 skips IMAP mark-seen. */
  async ingestEvent(event: EmailReceivedEvent): Promise<void> {
    await this.handleEmail(event, { skipMarkSeen: event.uid === 0 });
  }

  /**
   * Handle incoming email
   */
  private async handleEmail(
    event: EmailReceivedEvent,
    options: { skipMarkSeen?: boolean; imapListener?: ImapListener } = {}
  ): Promise<void> {
    const startTime = Date.now();
    const timing = {
      total: 0,
      parsing: 0,
      security: 0,
      analysis: 0,
      generation: 0,
    };
    
    logger.debug('[EmailProcessor] Processing email', {
      messageId: event.messageId,
      from: event.from,
      subject: event.subject,
      channelId: event.channelId,
      channelName: event.channelName,
      flow: event.flow,
    });
    
    this.emit('email:received', event);

    const flow: ChannelFlow = event.flow || 'standard'
    const channelMeta = {
      channelId: event.channelId,
      channelName: event.channelName,
      sourceChannel: event.channelName || event.channelId,
    }
    const runTasks = this.config.createTasks && flow !== 'ingest_only'
    const runGeneration =
      this.config.generateResponses && flow === 'standard'
    let persistedMessage = false
    
    try {
      // Step 1: Parse email
      const parseStart = Date.now();
      const parsed = await this.parser.parseFromEvent(event);
      timing.parsing = Date.now() - parseStart;
      
      this.emit('email:parsed', parsed);

      if (await EmailMessageService.exists(parsed.messageId)) {
        logger.info('[EmailProcessor] Skipping duplicate message', { messageId: parsed.messageId });
        await this.markSeenIfImap(event.uid, options);
        return;
      }
      
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
        try {
          const { emailCrmMetrics } = await import('./metrics')
          emailCrmMetrics.sanitizerRiskSpike(security.totalRiskScore)
        } catch {
          /* optional */
        }
        
        this.emit('email:blocked', { parsed, security });

        // Classifier may have billed before the block decision — still record it.
        await this.recordInjectionUsage(event.messageId, security, timing.security);
        
        await this.markSeenIfImap(event.uid, options);
        return;
      }
      try {
        const { emailCrmMetrics } = await import('./metrics')
        emailCrmMetrics.sanitizerRiskSpike(security.totalRiskScore)
      } catch {
        /* optional */
      }

      await this.recordInjectionUsage(event.messageId, security, timing.security);
      
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
      
      // Track analysis costs only when an LLM actually ran (skip fallback zeros).
      if (this.config.trackCosts) {
        if (this.llmWasBilled(intent)) {
          await this.costTracker.recordUsage({
            emailId: event.messageId,
            model: intent.model || 'deepseek/deepseek-chat',
            operation: 'intent_classification',
            inputTokens: intent.tokens.input,
            outputTokens: intent.tokens.output,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            latencyMs: timing.analysis,
            success: true,
            errorMessage: null,
            providerLlmCallId: intent.providerLlmCallId ?? null,
          });
        }

        if (this.llmWasBilled(sentiment)) {
          await this.costTracker.recordUsage({
            emailId: event.messageId,
            model: sentiment.model || 'deepseek/deepseek-chat',
            operation: 'sentiment_analysis',
            inputTokens: sentiment.tokens.input,
            outputTokens: sentiment.tokens.output,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            latencyMs: timing.analysis,
            success: true,
            errorMessage: null,
            providerLlmCallId: sentiment.providerLlmCallId ?? null,
          });
        }
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

      const isFirstContact = contact.totalInteractions === 1
      const crmOps = routeCrmOps({
        intent,
        parsed,
        isFirstContact,
      })

      const threadId = this.resolveThreadId(parsed);
      const priority = this.sentimentAnalyzer.getPriorityFromSentiment(sentiment);

      try {
        await EmailMessageService.upsertInboundMessage(
          parsed,
          threadId,
          intent,
          sentiment,
          channelMeta,
          {
            routeFlag: crmOps.routeFlag,
            unsubscribeUrl: crmOps.unsubscribeUrl,
          },
        );
        persistedMessage = true
        const failKey = event.uid > 0 ? `uid:${event.uid}` : `mid:${event.messageId}`
        this.prePersistFailCounts.delete(failKey)
      } catch (err) {
        logger.error('[EmailProcessor] Message persist failed', {
          messageId: parsed.messageId,
          error: (err as Error).message,
        });
      }

      try {
        await EmailThreadService.upsertThread(threadId, {
          subject: parsed.subject,
          fromEmail: parsed.from.email,
          fromName: parsed.from.name,
          status: parsed.isReply ? 'ongoing' : 'new',
          priority,
          intent: intent.intent,
          sentiment: sentiment.sentiment,
          messageCount: 1,
          hasDraft: false,
          lastMessageAt: parsed.date.toISOString(),
          contact: {
            type: contact.type,
            company: contact.company ?? null,
            interactions: contact.totalInteractions,
          },
          sourceChannel: channelMeta.sourceChannel,
          channelId: channelMeta.channelId,
          channelName: channelMeta.channelName,
          routeFlag: crmOps.routeFlag,
          unsubscribeUrl: crmOps.unsubscribeUrl,
        });
      } catch (err) {
        logger.error('[EmailProcessor] Thread persist failed', {
          threadId,
          messageId: event.messageId,
          error: (err as Error).message,
        });
      }

      // crm-ops tasks must run even on preferChat / before draft burn skip
      if (this.config.createTasks && crmOps.tasks.length > 0) {
        for (const opsTask of crmOps.tasks) {
          try {
            const created = await this.taskService.createTask({
              threadId,
              messageId: event.messageId,
              title: opsTask.title,
              description: opsTask.description,
              taskType: opsTask.taskType,
              priority: opsTask.priority,
              dueDays: opsTask.dueDays,
              autoGenerated: true,
              triggerReason: opsTask.triggerReason,
            })
            this.emit('task:created', created)
          } catch (err) {
            logger.error('[EmailProcessor] crm-ops task create failed', {
              messageId: event.messageId,
              error: (err as Error).message,
              triggerReason: opsTask.triggerReason,
            })
          }
        }
      }

      if (flow === 'ingest_only') {
        await this.markSeenIfImap(event.uid, options)
        timing.total = Date.now() - startTime
        this.processedCount++
        logger.info('[EmailProcessor] Ingest-only channel complete', {
          messageId: event.messageId,
          channelId: event.channelId,
          routeFlag: crmOps.routeFlag,
          totalTimeMs: timing.total,
        })
        return
      }

      // Client prefers in-app support chat — mirror email into chat, skip AI draft burn
      const preferChatActive = await this.mirrorInboundToSupportChat(threadId, parsed, contact)
      if (preferChatActive) {
        await this.markSeenIfImap(event.uid, options)
        timing.total = Date.now() - startTime
        this.processedCount++
        logger.info('[EmailProcessor] preferChat path complete (no email draft)', {
          messageId: event.messageId,
          threadId,
          routeFlag: crmOps.routeFlag,
          totalTimeMs: timing.total,
        })
        return
      }
      
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
      
      // Step 6: Create auto-rule tasks if enabled
      if (runTasks) {
        const tasks = await this.taskService.autoCreateTasks({
          threadId,
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
          this.emit('task:created', task);
        }
      }
      
      // Step 7: Generate response if enabled and not spam / crm-ops skip
      let generation: ResponseGenerationResult | undefined;
      let draftResult: DraftApprovalResult | undefined;
      
      if (runGeneration && intent.intent !== 'spam' && !crmOps.skipDraft) {
        const genStart = Date.now();
        
        generation = await this.responseGenerator.generate(
          context,
          security,
          {
            enableCaching: true,
            // Tools path is Anthropic-only opt-in; default uses email-llm (DeepSeek/Haiku)
            useTools: false,
            draftGuidance: crmOps.draftGuidance,
          }
        );
        
        timing.generation = Date.now() - genStart;
        
        // Track generation cost
        if (this.config.trackCosts && this.llmWasBilled(generation)) {
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
            providerLlmCallId: generation.providerLlmCallId ?? null,
          });
        }
        
        // Create draft
        draftResult = await this.draftService.createFromGeneration(
          event.messageId,
          threadId,
          generation,
          {
            intent: intent.intent,
            priority: context.guidance.priorityLevel,
            isNewContact: contact.totalInteractions === 1,
            securityPassed: generation.securityCheck.passed,
          }
        );
        
        this.emit('draft:created', draftResult);

        try {
          await EmailThreadService.upsertThread(threadId, { subject: parsed.subject, fromEmail: parsed.from.email, hasDraft: true, messageCount: 0, lastMessageAt: parsed.date.toISOString() });
        } catch (err) {
          logger.error('[EmailProcessor] Thread draft flag persist failed', {
            threadId,
            error: (err as Error).message,
          });
        }
        
        if (this.config.autoSendEnabled && draftResult.shouldAutoSend) {
          try {
            const existingThread = await EmailThreadService.getThread(threadId)
            if (existingThread?.preferChat) {
              logger.info('[EmailProcessor] Auto-send skipped — preferChat (support chat active)', {
                threadId,
                draftId: draftResult.draft.id,
              })
            } else {
            const sendResult = await sendDraftReply({
              draftId: draftResult.draft.id,
              toEmail: parsed.from.email,
              subject: parsed.subject,
              threadId,
              inReplyTo: parsed.messageId,
              references: parsed.references,
              wasAutoSent: true,
              channelId: event.channelId,
            });

            if (sendResult.skipped) {
              logger.info('[EmailProcessor] Auto-send skipped — preferChat', {
                draftId: draftResult.draft.id,
                threadId,
                notice: sendResult.notice,
              });
            } else {
            logger.info('[EmailProcessor] Auto-sent response', {
              draftId: draftResult.draft.id,
              confidence: generation.confidenceScore,
              sentMessageId: sendResult.messageId,
            });

            this.emit('draft:auto_sent', {
              draft: draftResult,
              messageId: sendResult.messageId,
            });
            }
            }
          } catch (sendErr) {
            logger.error('[EmailProcessor] Auto-send failed', {
              draftId: draftResult.draft.id,
              error: (sendErr as Error).message,
            });
          }
        }
      }
      
      await this.markSeenIfImap(event.uid, options);
      
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
        crmOps,
        processingTime: timing,
        blocked: false,
        autoSent: draftResult?.shouldAutoSend || false,
      };
      
      this.emit('email:processed', result);
      this.processedCount++;
      try {
        const { emailCrmMetrics } = await import('./metrics')
        emailCrmMetrics.processed()
      } catch {
        /* optional */
      }
      
      logger.info('[EmailProcessor] Email processed', {
        messageId: event.messageId,
        intent: intent.intent,
        sentiment: sentiment.sentiment,
        routeFlag: crmOps.routeFlag,
        skipDraft: crmOps.skipDraft,
        autoSent: result.autoSent,
        totalTimeMs: timing.total,
      });
    } catch (error) {
      logger.error('[EmailProcessor] Processing failed', {
        messageId: event.messageId,
        error: (error as Error).message,
        persistedMessage,
        willRetry: !persistedMessage,
      });

      try {
        const { emailCrmMetrics } = await import('./metrics')
        if (!persistedMessage) {
          emailCrmMetrics.prePersistFailure()
          emailCrmMetrics.willRetry()
        }
      } catch {
        /* optional */
      }

      // Durable ingest succeeded — mark seen so poison AI/downstream failures
      // do not re-enter the UNSEEN backlog every cron tick.
      if (persistedMessage) {
        await this.markSeenIfImap(event.uid, options);
      } else {
        await this.handlePrePersistFailure(event, options);
      }
      
      this.emit('error', error as Error);
    }
  }

  /**
   * Pre-persist poison: after N consecutive failures, move to CRM.Quarantine.
   * Until then leave UNSEEN for retry.
   */
  private async handlePrePersistFailure(
    event: EmailReceivedEvent,
    options: { skipMarkSeen?: boolean; imapListener?: ImapListener } = {},
  ): Promise<void> {
    const key = event.uid > 0 ? `uid:${event.uid}` : `mid:${event.messageId}`
    const next = (this.prePersistFailCounts.get(key) || 0) + 1
    this.prePersistFailCounts.set(key, next)

    if (next < EmailProcessor.QUARANTINE_AFTER) {
      logger.warn('[EmailProcessor] Pre-persist failure — will retry', {
        key,
        attempt: next,
        quarantineAfter: EmailProcessor.QUARANTINE_AFTER,
      })
      return
    }

    const listener = options.imapListener || this.imapListener
    if (options.skipMarkSeen || event.uid <= 0 || !listener.isConnected()) {
      logger.error('[EmailProcessor] Quarantine threshold hit but IMAP unavailable', {
        key,
        attempt: next,
      })
      return
    }

    try {
      await listener.ensureFolder(EmailProcessor.QUARANTINE_FOLDER)
      await listener.moveToFolder(event.uid, EmailProcessor.QUARANTINE_FOLDER)
      this.prePersistFailCounts.delete(key)
      try {
        const { emailCrmMetrics } = await import('./metrics')
        emailCrmMetrics.quarantined()
      } catch {
        /* optional */
      }
      logger.error('[EmailProcessor] Quarantined after pre-persist failures', {
        uid: event.uid,
        messageId: event.messageId,
        folder: EmailProcessor.QUARANTINE_FOLDER,
        attempts: next,
      })
    } catch (err) {
      logger.error('[EmailProcessor] Quarantine move failed', {
        uid: event.uid,
        error: (err as Error).message,
      })
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
  
  /** Prefer Ring-Support-Thread marker (header → body → subject), then References / In-Reply-To / Message-ID. */
  private resolveThreadId(parsed: ParsedEmail): string {
    const headerKey = Object.keys(parsed.rawHeaders || {}).find(
      (k) => k.toLowerCase() === RING_THREAD_HEADER.toLowerCase(),
    )
    const fromHeader = headerKey
      ? extractThreadMarker(`[Ring-Support-Thread: ${parsed.rawHeaders[headerKey]}]`) ||
        String(parsed.rawHeaders[headerKey] || '').trim()
      : null
    if (fromHeader) return fromHeader

    const fromBody =
      extractThreadMarker(parsed.bodyText) ||
      extractThreadMarker(parsed.bodyTextClean) ||
      extractThreadMarker(parsed.bodyHtml)
    if (fromBody) return fromBody
    const fromSubject = extractThreadMarker(parsed.subject)
    if (fromSubject) return fromSubject
    return parsed.externalThreadId || parsed.inReplyTo || parsed.messageId;
  }

  /**
   * When client opted into support chat (preferChat), mirror inbound email into that chat.
   * Returns true only when preferChat is active (caller should skip AI email drafts).
   */
  private async mirrorInboundToSupportChat(
    threadId: string,
    parsed: ParsedEmail,
    contact: EmailContact,
  ): Promise<boolean> {
    try {
      const thread = await EmailThreadService.getThread(threadId)
      if (!thread?.preferChat) return false

      const { ConversationService } = await import(
        '@/features/chat/services/conversation-service'
      )
      const { MessageService } = await import('@/features/chat/services/message-service')
      const conversationService = new ConversationService()
      const messageService = new MessageService()

      let conversation = await conversationService.findSupportConversation(threadId)

      if (!conversation && thread.supportConversationId) {
        const { db } = await import('@/lib/database')
        const read = await db().readDoc<{
          id: string
          type: string
          metadata?: { requesterUserId?: string }
          participants?: Array<{ userId: string }>
        }>('conversations', thread.supportConversationId)
        if (read.success && read.data?.type === 'support') {
          conversation = read.data as never
        }
      }

      if (!conversation) {
        logger.info('[EmailProcessor] preferChat set but no support conversation yet', {
          threadId,
        })
        return true
      }

      const requesterId =
        (conversation as { metadata?: { requesterUserId?: string } }).metadata
          ?.requesterUserId ||
        contact.ringUserId ||
        conversation.participants?.[0]?.userId

      if (!requesterId) return true

      const body =
        parsed.bodyTextClean ||
        parsed.bodyText ||
        parsed.subject ||
        '(empty email)'

      await messageService.sendMessage(
        {
          conversationId: conversation.id,
          content: body.slice(0, 8000),
          type: 'text',
          metadata: {
            kind: 'email_mirror',
            supportRequestId: threadId,
            source: 'inbound_email',
            emailMessageId: parsed.messageId,
          },
        },
        requesterId,
        contact.name || parsed.from.name || parsed.from.email,
      )

      logger.info('[EmailProcessor] Mirrored inbound email into support chat', {
        threadId,
        conversationId: conversation.id,
        messageId: parsed.messageId,
      })
      return true
    } catch (error) {
      logger.warn('[EmailProcessor] Support-chat mirror failed', {
        threadId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Still skip drafts if preferChat was the intent — re-check thread
      try {
        const thread = await EmailThreadService.getThread(threadId)
        return Boolean(thread?.preferChat)
      } catch {
        return false
      }
    }
  }

  private llmWasBilled(call: {
    tokens?: { input?: number; output?: number }
    providerLlmCallId?: string | null
    llmCalled?: boolean
  }): boolean {
    if (call.llmCalled) return true
    if (call.providerLlmCallId) return true
    return (call.tokens?.input ?? 0) + (call.tokens?.output ?? 0) > 0
  }

  private async recordInjectionUsage(
    emailId: string,
    security: SecurityCheckResult,
    latencyMs: number
  ): Promise<void> {
    const classification = security.classification
    if (!this.config.trackCosts || !classification || !this.llmWasBilled(classification)) {
      return
    }
    await this.costTracker.recordUsage({
      emailId,
      model: classification.model || 'deepseek/deepseek-chat',
      operation: 'injection_classification',
      inputTokens: classification.tokens?.input ?? 0,
      outputTokens: classification.tokens?.output ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      latencyMs,
      success: true,
      errorMessage: null,
      providerLlmCallId: classification.providerLlmCallId ?? null,
    })
  }

  private async markSeenIfImap(
    uid: number,
    options: { skipMarkSeen?: boolean; imapListener?: ImapListener } = {},
  ): Promise<void> {
    if (options.skipMarkSeen || uid <= 0) return;
    const listener = options.imapListener || this.imapListener;
    if (!listener.isConnected()) return;
    try {
      await listener.markAsSeen(uid);
    } catch (err) {
      logger.warn('[EmailProcessor] markAsSeen failed', {
        uid,
        error: (err as Error).message,
      });
      try {
        const { emailCrmMetrics } = await import('./metrics')
        emailCrmMetrics.markSeenFailed()
      } catch {
        /* optional */
      }
    }
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
    wireEmailNotifications(processorInstance);
  }
  return processorInstance;
}

export default EmailProcessor;
