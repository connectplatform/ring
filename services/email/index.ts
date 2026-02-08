/**
 * Email Service Module
 * ====================
 * AI-Assisted Email Management for info@ringdom.org
 * 
 * Architecture:
 * - IMAP: Real-time email listening via IMAP IDLE
 * - Parser: Email parsing and thread reconstruction
 * - Security: 4-layer prompt injection defense
 * - AI: Intent classification, sentiment analysis, response generation
 * - CRM: Contact registry and task management
 * - Drafts: Review queue with auto-send
 */

// Main processor
export { EmailProcessor, getEmailProcessor } from './email-processor';
export type { ProcessedEmail, ProcessorEvents } from './email-processor';

// IMAP
export { ImapListener, getImapListener, emailConfig, validateEmailConfig } from './imap';
export type { EmailReceivedEvent, EmailConfig } from './imap';

// Parser
export { EmailParser, getEmailParser } from './parser';
export type { ParsedEmail, ParsedAttachment } from './parser';

// Security
export { 
  SecurityPipeline, 
  getSecurityPipeline,
  InputSanitizer,
  getInputSanitizer,
  InjectionClassifier,
  getInjectionClassifier,
  Spotlighting,
  getSpotlighting,
  OutputValidator,
  getOutputValidator,
  SYSTEM_PROMPT_WITH_SPOTLIGHTING
} from './security';
export type { 
  SecurityCheckResult, 
  OutputCheckResult,
  SanitizationResult,
  InjectionClassification
} from './security';

// AI
export {
  IntentClassifier,
  getIntentClassifier,
  SentimentAnalyzer,
  getSentimentAnalyzer,
  ContextBuilder,
  getContextBuilder,
  ResponseGenerator,
  getResponseGenerator,
  CostTracker,
  getCostTracker
} from './ai';
export type {
  EmailIntent,
  IntentClassification,
  SentimentCategory,
  SentimentAnalysis,
  EmailContext,
  ResponseGenerationResult,
  UsageRecord,
  DailyStats
} from './ai';

// CRM
export {
  EmailContactService,
  getEmailContactService,
  EmailTaskService,
  getEmailTaskService
} from './crm';
export type {
  EmailContact,
  ContactType,
  EmailTask,
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskAutoCreationRule
} from './crm';

// Drafts
export { EmailDraftService, getEmailDraftService } from './drafts';
export type {
  EmailDraft,
  DraftStatus,
  DraftApprovalResult,
  AutoSendConfig
} from './drafts';

// Notifications
export { EmailNotificationService, getEmailNotificationService } from './notifications';
export type { EmailNotificationType, EmailNotification } from './notifications';

// Knowledge Base
export { KnowledgeBaseService, getKnowledgeBaseService } from './knowledge';
export type { KnowledgeDocument, SearchResult } from './knowledge';

// Batch Analytics
export { BatchAnalyticsService, getBatchAnalyticsService } from './ai';
export type { BatchJob, BatchJobType } from './ai';
