/**
 * Email Draft Service
 * ===================
 * Manages AI-generated email response drafts with approval workflow
 * Reference: Email Automation Specialist skillset
 */

import { logger } from '@/lib/logger';
import { ResponseGenerationResult, ToolUsageRecord } from '../ai/response-generator';

export interface EmailDraft {
  id: string;
  messageId: string;
  threadId: string;
  draftContent: string;
  draftHtml: string | null;
  confidenceScore: number;
  modelUsed: string;
  modelReasoning: string | null;
  toolsUsed: ToolUsageRecord[];
  status: DraftStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  editNotes: string | null;
  sentAt: Date | null;
  sentMessageId: string | null;
  createdAt: Date;
}

export type DraftStatus = 'pending' | 'approved' | 'edited' | 'sent' | 'rejected' | 'auto_sent';

export interface DraftCreateInput {
  messageId: string;
  threadId: string;
  draftContent: string;
  draftHtml?: string;
  confidenceScore: number;
  modelUsed: string;
  modelReasoning?: string;
  toolsUsed?: ToolUsageRecord[];
}

export interface DraftUpdateInput {
  draftContent?: string;
  draftHtml?: string;
  status?: DraftStatus;
  editNotes?: string;
}

export interface DraftApprovalResult {
  draft: EmailDraft;
  shouldAutoSend: boolean;
  requiresReview: boolean;
  warnings: string[];
}

// Auto-send configuration
export interface AutoSendConfig {
  enabled: boolean;
  minConfidence: number; // Minimum confidence for auto-send
  allowedIntents: string[]; // Intents that can be auto-sent
  maxDailyAutoSends: number; // Rate limit
  requireSecurityPass: boolean; // Must pass security validation
  excludeNewContacts: boolean; // Don't auto-send to new contacts
  excludeHighPriority: boolean; // Don't auto-send high priority
}

const DEFAULT_AUTO_SEND_CONFIG: AutoSendConfig = {
  enabled: true,
  minConfidence: 0.90,
  allowedIntents: [
    'documentation_help',
    'getting_started',
    'general_inquiry',
    'feedback',
    'feature_request',
  ],
  maxDailyAutoSends: 50,
  requireSecurityPass: true,
  excludeNewContacts: true,
  excludeHighPriority: true,
};

// Repository interface
export interface DraftRepository {
  findById(id: string): Promise<EmailDraft | null>;
  findByMessageId(messageId: string): Promise<EmailDraft | null>;
  findByThreadId(threadId: string): Promise<EmailDraft[]>;
  findPending(limit?: number): Promise<EmailDraft[]>;
  create(input: DraftCreateInput): Promise<EmailDraft>;
  update(id: string, input: DraftUpdateInput): Promise<EmailDraft>;
  markSent(id: string, sentMessageId: string): Promise<EmailDraft>;
  countTodayAutoSends(): Promise<number>;
}

export class EmailDraftService {
  private config: AutoSendConfig;
  
  constructor(
    private repository: DraftRepository,
    config?: Partial<AutoSendConfig>
  ) {
    this.config = { ...DEFAULT_AUTO_SEND_CONFIG, ...config };
  }
  
  /**
   * Create draft from AI generation result
   */
  async createFromGeneration(
    messageId: string,
    threadId: string,
    result: ResponseGenerationResult,
    context: {
      intent: string;
      priority: string;
      isNewContact: boolean;
      securityPassed: boolean;
    }
  ): Promise<DraftApprovalResult> {
    // Create the draft
    const draft = await this.repository.create({
      messageId,
      threadId,
      draftContent: result.draftContent,
      confidenceScore: result.confidenceScore,
      modelUsed: result.modelUsed,
      modelReasoning: result.reasoning,
      toolsUsed: result.toolsUsed,
    });
    
    // Check if auto-send is possible
    const autoSendResult = await this.checkAutoSend(draft, context);
    
    logger.info('[EmailDraftService] Draft created', {
      draftId: draft.id,
      messageId,
      confidenceScore: result.confidenceScore,
      shouldAutoSend: autoSendResult.shouldAutoSend,
      requiresReview: autoSendResult.requiresReview,
    });
    
    return {
      draft,
      ...autoSendResult,
    };
  }
  
  /**
   * Check if draft qualifies for auto-send
   */
  private async checkAutoSend(
    draft: EmailDraft,
    context: {
      intent: string;
      priority: string;
      isNewContact: boolean;
      securityPassed: boolean;
    }
  ): Promise<{
    shouldAutoSend: boolean;
    requiresReview: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    // Check if auto-send is enabled
    if (!this.config.enabled) {
      return { shouldAutoSend: false, requiresReview: true, warnings: ['Auto-send disabled'] };
    }
    
    // Check confidence threshold
    if (draft.confidenceScore < this.config.minConfidence) {
      warnings.push(`Confidence ${draft.confidenceScore} below threshold ${this.config.minConfidence}`);
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // Check allowed intents
    if (!this.config.allowedIntents.includes(context.intent)) {
      warnings.push(`Intent "${context.intent}" not in auto-send list`);
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // Check security requirement
    if (this.config.requireSecurityPass && !context.securityPassed) {
      warnings.push('Security check did not pass');
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // Check new contact exclusion
    if (this.config.excludeNewContacts && context.isNewContact) {
      warnings.push('New contact - excluded from auto-send');
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // Check high priority exclusion
    if (this.config.excludeHighPriority && ['high', 'urgent'].includes(context.priority)) {
      warnings.push('High priority - requires review');
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // Check daily rate limit
    const todayCount = await this.repository.countTodayAutoSends();
    if (todayCount >= this.config.maxDailyAutoSends) {
      warnings.push(`Daily auto-send limit (${this.config.maxDailyAutoSends}) reached`);
      return { shouldAutoSend: false, requiresReview: true, warnings };
    }
    
    // All checks passed - can auto-send
    return { shouldAutoSend: true, requiresReview: false, warnings: [] };
  }
  
  /**
   * Get pending drafts for review
   */
  async getPendingDrafts(limit = 50): Promise<EmailDraft[]> {
    return this.repository.findPending(limit);
  }
  
  /**
   * Get draft by ID
   */
  async getDraft(id: string): Promise<EmailDraft | null> {
    return this.repository.findById(id);
  }
  
  /**
   * Get drafts for a thread
   */
  async getThreadDrafts(threadId: string): Promise<EmailDraft[]> {
    return this.repository.findByThreadId(threadId);
  }
  
  /**
   * Approve draft for sending
   */
  async approveDraft(id: string, reviewerId: string): Promise<EmailDraft> {
    const draft = await this.repository.update(id, {
      status: 'approved',
    });
    
    // Update with reviewer info via separate update
    const approved = await this.repository.findById(id);
    if (approved) {
      (approved as any).reviewedBy = reviewerId;
      (approved as any).reviewedAt = new Date();
    }
    
    logger.info('[EmailDraftService] Draft approved', {
      draftId: id,
      reviewerId,
    });
    
    return draft;
  }
  
  /**
   * Edit and approve draft
   */
  async editAndApproveDraft(
    id: string,
    newContent: string,
    reviewerId: string,
    editNotes?: string
  ): Promise<EmailDraft> {
    const draft = await this.repository.update(id, {
      draftContent: newContent,
      status: 'edited',
      editNotes,
    });
    
    logger.info('[EmailDraftService] Draft edited and approved', {
      draftId: id,
      reviewerId,
      hasEditNotes: !!editNotes,
    });
    
    return draft;
  }
  
  /**
   * Reject draft
   */
  async rejectDraft(id: string, reviewerId: string, reason?: string): Promise<EmailDraft> {
    const draft = await this.repository.update(id, {
      status: 'rejected',
      editNotes: reason,
    });
    
    logger.info('[EmailDraftService] Draft rejected', {
      draftId: id,
      reviewerId,
      reason,
    });
    
    return draft;
  }
  
  /**
   * Mark draft as sent
   */
  async markSent(id: string, sentMessageId: string, wasAutoSent = false): Promise<EmailDraft> {
    const status: DraftStatus = wasAutoSent ? 'auto_sent' : 'sent';
    
    // First update status
    await this.repository.update(id, { status });
    
    // Then mark sent with message ID
    const draft = await this.repository.markSent(id, sentMessageId);
    
    logger.info('[EmailDraftService] Draft marked as sent', {
      draftId: id,
      sentMessageId,
      wasAutoSent,
    });
    
    return draft;
  }
  
  /**
   * Get draft statistics
   */
  async getStatistics(): Promise<{
    totalDrafts: number;
    byStatus: Record<DraftStatus, number>;
    avgConfidence: number;
    autoSendRate: number;
    todayAutoSends: number;
  }> {
    // Get all drafts (in production would use aggregation query)
    const pending = await this.repository.findPending(10000);
    const allDrafts: EmailDraft[] = pending; // Simplified - in prod would query all
    
    const byStatus: Record<DraftStatus, number> = {
      pending: 0,
      approved: 0,
      edited: 0,
      sent: 0,
      rejected: 0,
      auto_sent: 0,
    };
    
    let totalConfidence = 0;
    let autoSentCount = 0;
    let sentCount = 0;
    
    for (const draft of allDrafts) {
      byStatus[draft.status]++;
      totalConfidence += draft.confidenceScore;
      if (draft.status === 'auto_sent') autoSentCount++;
      if (draft.status === 'sent' || draft.status === 'auto_sent') sentCount++;
    }
    
    const avgConfidence = allDrafts.length > 0 
      ? Math.round(totalConfidence / allDrafts.length * 100) / 100
      : 0;
    
    const autoSendRate = sentCount > 0 
      ? Math.round(autoSentCount / sentCount * 100) / 100
      : 0;
    
    const todayAutoSends = await this.repository.countTodayAutoSends();
    
    return {
      totalDrafts: allDrafts.length,
      byStatus,
      avgConfidence,
      autoSendRate,
      todayAutoSends,
    };
  }
  
  /**
   * Update auto-send configuration
   */
  updateConfig(updates: Partial<AutoSendConfig>): void {
    this.config = { ...this.config, ...updates };
    
    logger.info('[EmailDraftService] Config updated', {
      enabled: this.config.enabled,
      minConfidence: this.config.minConfidence,
      maxDailyAutoSends: this.config.maxDailyAutoSends,
    });
  }
  
  /**
   * Get current configuration
   */
  getConfig(): AutoSendConfig {
    return { ...this.config };
  }
}

// In-memory repository
export class InMemoryDraftRepository implements DraftRepository {
  private drafts: Map<string, EmailDraft> = new Map();
  private counter = 0;
  
  async findById(id: string): Promise<EmailDraft | null> {
    return this.drafts.get(id) || null;
  }
  
  async findByMessageId(messageId: string): Promise<EmailDraft | null> {
    for (const draft of this.drafts.values()) {
      if (draft.messageId === messageId) {
        return draft;
      }
    }
    return null;
  }
  
  async findByThreadId(threadId: string): Promise<EmailDraft[]> {
    return Array.from(this.drafts.values()).filter(d => d.threadId === threadId);
  }
  
  async findPending(limit = 50): Promise<EmailDraft[]> {
    return Array.from(this.drafts.values())
      .filter(d => d.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  async create(input: DraftCreateInput): Promise<EmailDraft> {
    const id = `draft_${++this.counter}`;
    const draft: EmailDraft = {
      id,
      messageId: input.messageId,
      threadId: input.threadId,
      draftContent: input.draftContent,
      draftHtml: input.draftHtml || null,
      confidenceScore: input.confidenceScore,
      modelUsed: input.modelUsed,
      modelReasoning: input.modelReasoning || null,
      toolsUsed: input.toolsUsed || [],
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      editNotes: null,
      sentAt: null,
      sentMessageId: null,
      createdAt: new Date(),
    };
    
    this.drafts.set(id, draft);
    return draft;
  }
  
  async update(id: string, input: DraftUpdateInput): Promise<EmailDraft> {
    const draft = this.drafts.get(id);
    if (!draft) throw new Error('Draft not found');
    
    const updated: EmailDraft = {
      ...draft,
      ...input,
    };
    
    this.drafts.set(id, updated);
    return updated;
  }
  
  async markSent(id: string, sentMessageId: string): Promise<EmailDraft> {
    const draft = this.drafts.get(id);
    if (!draft) throw new Error('Draft not found');
    
    const updated: EmailDraft = {
      ...draft,
      sentAt: new Date(),
      sentMessageId,
    };
    
    this.drafts.set(id, updated);
    return updated;
  }
  
  async countTodayAutoSends(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let count = 0;
    for (const draft of this.drafts.values()) {
      if (
        draft.status === 'auto_sent' &&
        draft.sentAt &&
        draft.sentAt >= today
      ) {
        count++;
      }
    }
    
    return count;
  }
}

// Singleton
let serviceInstance: EmailDraftService | null = null;

export function getEmailDraftService(): EmailDraftService {
  if (!serviceInstance) {
    serviceInstance = new EmailDraftService(new InMemoryDraftRepository());
  }
  return serviceInstance;
}

export default EmailDraftService;
