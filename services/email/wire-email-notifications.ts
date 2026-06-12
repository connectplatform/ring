import type { EmailProcessor } from './email-processor';
import { getEmailNotificationService } from './notifications';
import { logger } from '@/lib/logger';

let wired = false;

/** Subscribe processor events to EmailNotificationService (idempotent). */
export function wireEmailNotifications(processor: EmailProcessor): void {
  if (wired) return;
  wired = true;
  const notifications = getEmailNotificationService();

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    notifications.setSlackWebhook(slackUrl);
  }

  processor.on('draft:created', async (result) => {
    if (result.requiresReview) {
      await notifications.notifyDraftReady({
        draftId: result.draft.id,
        threadId: result.draft.threadId,
        subject: result.draft.threadId,
        confidence: Math.round(result.draft.confidenceScore * 100),
      });
    }
  });

  processor.on('draft:auto_sent', async (result) => {
    await notifications.notifyAutoSent({
      draftId: result.draft.draft.id,
      recipientEmail: result.draft.draft.threadId,
      subject: result.draft.draft.threadId,
      confidence: result.draft.draft.confidenceScore,
    });
  });

  processor.on('task:created', async (task) => {
    await notifications.notifyTaskCreated({
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.taskType,
      dueDate: task.dueDate,
      assignedTo: task.assignedTo,
      threadId: task.threadId,
    });
  });

  processor.on('email:blocked', async ({ parsed, security }) => {
    await notifications.notifySecurityAlert({
      senderEmail: parsed.from.email,
      messageId: parsed.messageId,
      riskScore: security.totalRiskScore,
      technique: security.classification?.technique ?? null,
      flaggedPatterns: security.sanitization.flaggedPatterns.map((p) => p.type),
    });
  });

  processor.on('email:processed', async (result) => {
    const priority = result.context?.guidance?.priorityLevel;
    if (priority === 'urgent' || priority === 'high') {
      await notifications.notifyNewEmail({
        threadId: result.parsed.externalThreadId || result.parsed.messageId,
        messageId: result.parsed.messageId,
        senderEmail: result.parsed.from.email,
        senderName: result.parsed.from.name,
        subject: result.parsed.subject,
        intent: result.intent.intent,
        priority,
      });
    }
  });

  logger.info('[EmailProcessor] Notifications wired');
}
