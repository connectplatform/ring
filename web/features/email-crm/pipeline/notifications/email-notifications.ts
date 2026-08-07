/**
 * Email Notification Service
 * ==========================
 * Integrates with existing NotificationService for email-related alerts
 * Reference: Email Automation Specialist skillset
 */

import { logger } from '@/lib/logger';

export type EmailNotificationType = 
  | 'new_email'
  | 'high_priority_email'
  | 'draft_ready'
  | 'draft_approved'
  | 'draft_rejected'
  | 'auto_sent'
  | 'task_created'
  | 'task_overdue'
  | 'security_alert'
  | 'at_risk_customer';

export interface EmailNotification {
  type: EmailNotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  recipients: string[]; // User IDs or 'all'
  channels: ('in_app' | 'email' | 'slack')[];
}

// Notification templates
const NOTIFICATION_TEMPLATES: Record<EmailNotificationType, {
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('in_app' | 'email' | 'slack')[];
}> = {
  new_email: {
    title: 'New Email Received',
    message: 'New email from {senderName} ({senderEmail}): {subject}',
    priority: 'normal',
    channels: ['in_app'],
  },
  high_priority_email: {
    title: 'High Priority Email',
    message: 'Urgent email from {senderName} requires attention: {subject}',
    priority: 'urgent',
    channels: ['in_app', 'slack'],
  },
  draft_ready: {
    title: 'Draft Ready for Review',
    message: 'AI generated response for "{subject}" - {confidence}% confidence',
    priority: 'normal',
    channels: ['in_app'],
  },
  draft_approved: {
    title: 'Draft Approved',
    message: 'Response to "{subject}" has been approved and queued for sending',
    priority: 'low',
    channels: ['in_app'],
  },
  draft_rejected: {
    title: 'Draft Rejected',
    message: 'Response to "{subject}" was rejected: {reason}',
    priority: 'normal',
    channels: ['in_app'],
  },
  auto_sent: {
    title: 'Auto-Sent Response',
    message: 'High-confidence response sent to {recipientEmail} for "{subject}"',
    priority: 'low',
    channels: ['in_app'],
  },
  task_created: {
    title: 'New Task Created',
    message: 'Task created: {taskTitle} - Due {dueDate}',
    priority: 'normal',
    channels: ['in_app'],
  },
  task_overdue: {
    title: 'Task Overdue',
    message: 'Task "{taskTitle}" is overdue - was due {dueDate}',
    priority: 'high',
    channels: ['in_app', 'email'],
  },
  security_alert: {
    title: 'Security Alert',
    message: 'Potential prompt injection detected in email from {senderEmail}',
    priority: 'urgent',
    channels: ['in_app', 'slack'],
  },
  at_risk_customer: {
    title: 'At-Risk Customer Alert',
    message: 'Customer {contactName} showing declining sentiment - review recommended',
    priority: 'high',
    channels: ['in_app', 'slack'],
  },
};

// Notification service interface (matches existing NotificationService pattern)
export interface NotificationServiceInterface {
  send(notification: {
    userId?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    channel?: string;
  }): Promise<void>;
}

export class EmailNotificationService {
  private notificationService: NotificationServiceInterface | null = null;
  private slackWebhookUrl: string | null = null;
  
  // Recipients for different notification types
  private recipientRules: Record<EmailNotificationType, string[]> = {
    new_email: ['support_team'],
    high_priority_email: ['support_team', 'managers'],
    draft_ready: ['support_team'],
    draft_approved: ['support_team'],
    draft_rejected: ['support_team'],
    auto_sent: ['support_team'],
    task_created: ['assigned_user', 'support_team'],
    task_overdue: ['assigned_user', 'managers'],
    security_alert: ['security_team', 'managers'],
    at_risk_customer: ['support_team', 'managers'],
  };
  
  /**
   * Set the notification service instance
   */
  setNotificationService(service: NotificationServiceInterface): void {
    this.notificationService = service;
  }
  
  /**
   * Set Slack webhook URL for Slack notifications
   */
  setSlackWebhook(url: string): void {
    this.slackWebhookUrl = url;
  }
  
  /**
   * Send notification for new email
   */
  async notifyNewEmail(params: {
    threadId: string;
    messageId: string;
    senderEmail: string;
    senderName: string | null;
    subject: string;
    intent: string;
    priority: string;
  }): Promise<void> {
    const isHighPriority = params.priority === 'high' || params.priority === 'urgent';
    const type: EmailNotificationType = isHighPriority ? 'high_priority_email' : 'new_email';
    
    await this.send(type, {
      senderEmail: params.senderEmail,
      senderName: params.senderName || params.senderEmail,
      subject: params.subject,
      intent: params.intent,
      threadId: params.threadId,
      messageId: params.messageId,
    });
  }
  
  /**
   * Send notification for draft ready
   */
  async notifyDraftReady(params: {
    draftId: string;
    threadId: string;
    subject: string;
    confidence: number;
  }): Promise<void> {
    await this.send('draft_ready', {
      draftId: params.draftId,
      threadId: params.threadId,
      subject: params.subject,
      confidence: Math.round(params.confidence * 100),
    });
  }
  
  /**
   * Send notification for draft approved
   */
  async notifyDraftApproved(params: {
    draftId: string;
    subject: string;
    reviewerId: string;
  }): Promise<void> {
    await this.send('draft_approved', {
      draftId: params.draftId,
      subject: params.subject,
      reviewerId: params.reviewerId,
    });
  }
  
  /**
   * Send notification for draft rejected
   */
  async notifyDraftRejected(params: {
    draftId: string;
    subject: string;
    reason: string;
    reviewerId: string;
  }): Promise<void> {
    await this.send('draft_rejected', {
      draftId: params.draftId,
      subject: params.subject,
      reason: params.reason,
      reviewerId: params.reviewerId,
    });
  }
  
  /**
   * Send notification for auto-sent response
   */
  async notifyAutoSent(params: {
    draftId: string;
    subject: string;
    recipientEmail: string;
    confidence: number;
  }): Promise<void> {
    await this.send('auto_sent', {
      draftId: params.draftId,
      subject: params.subject,
      recipientEmail: params.recipientEmail,
      confidence: Math.round(params.confidence * 100),
    });
  }
  
  /**
   * Send notification for task created
   */
  async notifyTaskCreated(params: {
    taskId: string;
    taskTitle: string;
    taskType: string;
    dueDate: Date | null;
    assignedTo: string | null;
    threadId: string;
  }): Promise<void> {
    await this.send('task_created', {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      taskType: params.taskType,
      dueDate: params.dueDate?.toLocaleDateString() || 'No due date',
      assignedTo: params.assignedTo,
      threadId: params.threadId,
    });
  }
  
  /**
   * Send notification for overdue task
   */
  async notifyTaskOverdue(params: {
    taskId: string;
    taskTitle: string;
    dueDate: Date;
    assignedTo: string | null;
  }): Promise<void> {
    await this.send('task_overdue', {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      dueDate: params.dueDate.toLocaleDateString(),
      assignedTo: params.assignedTo,
    });
  }
  
  /**
   * Send security alert notification
   */
  async notifySecurityAlert(params: {
    messageId: string;
    senderEmail: string;
    riskScore: number;
    technique: string | null;
    flaggedPatterns: string[];
  }): Promise<void> {
    await this.send('security_alert', {
      messageId: params.messageId,
      senderEmail: params.senderEmail,
      riskScore: Math.round(params.riskScore * 100),
      technique: params.technique,
      flaggedPatterns: params.flaggedPatterns,
    });
  }
  
  /**
   * Send at-risk customer alert
   */
  async notifyAtRiskCustomer(params: {
    contactId: string;
    contactEmail: string;
    contactName: string | null;
    sentimentTrend: string;
    recentSentiment: string;
    totalInteractions: number;
  }): Promise<void> {
    await this.send('at_risk_customer', {
      contactId: params.contactId,
      contactEmail: params.contactEmail,
      contactName: params.contactName || params.contactEmail,
      sentimentTrend: params.sentimentTrend,
      recentSentiment: params.recentSentiment,
      totalInteractions: params.totalInteractions,
    });
  }
  
  /**
   * Core send method
   */
  private async send(
    type: EmailNotificationType,
    data: Record<string, unknown>
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      logger.warn('[EmailNotificationService] Unknown notification type', { type });
      return;
    }
    
    // Apply template variables
    const title = this.applyTemplate(template.title, data);
    const message = this.applyTemplate(template.message, data);
    
    const notification: EmailNotification = {
      type,
      title,
      message,
      data,
      priority: template.priority,
      recipients: this.recipientRules[type] || ['support_team'],
      channels: template.channels,
    };
    
    logger.info('[EmailNotificationService] Sending notification', {
      type,
      title,
      priority: notification.priority,
      channels: notification.channels,
    });
    
    // Send via different channels
    const promises: Promise<void>[] = [];
    
    if (notification.channels.includes('in_app') && this.notificationService) {
      promises.push(this.sendInApp(notification));
    }
    
    if (notification.channels.includes('slack') && this.slackWebhookUrl) {
      promises.push(this.sendSlack(notification));
    }
    
    // Email channel would use a different service
    // if (notification.channels.includes('email')) {
    //   promises.push(this.sendEmail(notification));
    // }
    
    await Promise.all(promises);
  }
  
  /**
   * Send in-app notification
   */
  private async sendInApp(notification: EmailNotification): Promise<void> {
    if (!this.notificationService) return;
    
    try {
      // For each recipient group, send to all users
      for (const recipient of notification.recipients) {
        await this.notificationService.send({
          userId: recipient, // In production, resolve to actual user IDs
          type: `email.${notification.type}`,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          channel: 'in_app',
        });
      }
    } catch (error) {
      logger.error('[EmailNotificationService] Failed to send in-app notification', {
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Send Slack notification
   */
  private async sendSlack(notification: EmailNotification): Promise<void> {
    if (!this.slackWebhookUrl) return;
    
    try {
      const slackMessage = {
        text: notification.title,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: notification.title,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: notification.message,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Priority: *${notification.priority}* | Type: ${notification.type}`,
              },
            ],
          },
        ],
      };
      
      await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
      });
    } catch (error) {
      logger.error('[EmailNotificationService] Failed to send Slack notification', {
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Apply template variables
   */
  private applyTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }
  
  /**
   * Update recipient rules
   */
  setRecipientRules(type: EmailNotificationType, recipients: string[]): void {
    this.recipientRules[type] = recipients;
  }
}

// Singleton
let serviceInstance: EmailNotificationService | null = null;

export function getEmailNotificationService(): EmailNotificationService {
  if (!serviceInstance) {
    serviceInstance = new EmailNotificationService();
  }
  return serviceInstance;
}

export default EmailNotificationService;
