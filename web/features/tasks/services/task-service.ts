import { MessageService } from '@/features/chat/services/message-service'
import { ConversationService } from '@/features/chat/services/conversation-service'
import type { Message, TaskMetadata } from '@/features/chat/types'
import {
  canDeleteTask,
  canEditTask,
  parseTaskMetadata,
  taskFallbackContent,
} from '@/features/tasks/types'
import { TaskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { notifyTaskAssigned, notifyTaskUpdated } from '@/features/tasks/services/notify'
import { ValidationError } from '@/lib/errors'

type AuditEntry = NonNullable<TaskMetadata['audit']>[number]

export class TaskService {
  private messages = new MessageService()
  private conversations = new ConversationService()
  private escrow = new TaskEscrowService()

  private auditEntry(
    userId: string,
    action: string,
    from?: string,
    to?: string,
  ): AuditEntry {
    return { at: new Date().toISOString(), by: userId, action, from, to }
  }

  private appendAudit(
    meta: TaskMetadata,
    userId: string,
    action: string,
    from?: string,
    to?: string,
  ): TaskMetadata {
    return {
      ...meta,
      audit: [...(meta.audit ?? []), this.auditEntry(userId, action, from, to)],
    }
  }

  async loadTask(messageId: string, userId: string) {
    const message = await this.messages.getMessage(messageId)
    if (!message) {
      throw new ValidationError('Task message not found', undefined, {
        messageId,
        operation: 'loadTask',
      })
    }

    const meta = parseTaskMetadata(message)
    if (!meta) {
      throw new ValidationError('Invalid task metadata', undefined, {
        messageId,
        operation: 'loadTask',
      })
    }

    const conversation = await this.conversations.getConversationById(
      message.conversationId,
      userId,
    )
    if (!conversation) {
      throw new ValidationError('Access denied', undefined, {
        messageId,
        userId,
        operation: 'loadTask',
      })
    }

    return { message, meta, conversation }
  }

  private async persistTaskUpdate(
    messageId: string,
    meta: TaskMetadata,
    content?: string,
    notify?: { actorUserId: string; action: string; conversationId: string },
  ): Promise<Message> {
    const updates: Partial<Message> = {
      metadata: meta as unknown as Record<string, unknown>,
    }
    if (content !== undefined) {
      updates.content = content
    }
    const message = await this.messages.updateMessage(messageId, updates)

    if (notify) {
      void notifyTaskUpdated({
        meta,
        messageId,
        conversationId: notify.conversationId,
        actorUserId: notify.actorUserId,
        action: notify.action,
      })
      if (
        notify.action === 'approve_request' &&
        meta.assigneeUserId &&
        meta.assigneeUserId !== notify.actorUserId
      ) {
        void notifyTaskAssigned({
          assigneeUserId: meta.assigneeUserId,
          conversationId: notify.conversationId,
          messageId,
        })
      }
    }

    return message
  }

  async startTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId === userId) {
      throw new ValidationError('Reporter cannot start their own task')
    }
    if (meta.status !== 'available') {
      throw new ValidationError('Task is not available')
    }
    const escrowPs = meta.escrow?.paymentStatus ?? 'none'
    if (meta.escrow?.enabled && (escrowPs === 'pending' || escrowPs === 'failed')) {
      throw new ValidationError('Task escrow is not funded yet')
    }

    const now = new Date().toISOString()
    const next = this.appendAudit(
      {
        ...meta,
        status: 'in_progress',
        assigneeUserId: userId,
        startedAt: now,
        requestedByUserId: undefined,
      },
      userId,
      'start',
      'available',
      'in_progress',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'start',
      conversationId: message.conversationId,
    })
  }

  async requestTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId === userId) {
      throw new ValidationError('Reporter cannot request their own task')
    }
    if (meta.status !== 'available') {
      throw new ValidationError('Task is not available')
    }
    const escrowPs = meta.escrow?.paymentStatus ?? 'none'
    if (meta.escrow?.enabled && (escrowPs === 'pending' || escrowPs === 'failed')) {
      throw new ValidationError('Task escrow is not funded yet')
    }

    const next = this.appendAudit(
      {
        ...meta,
        status: 'requested',
        requestedByUserId: userId,
      },
      userId,
      'request',
      'available',
      'requested',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'request',
      conversationId: message.conversationId,
    })
  }

  async approveTaskRequest(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can approve requests')
    }
    if (meta.status !== 'requested' || !meta.requestedByUserId) {
      throw new ValidationError('No pending task request')
    }

    const now = new Date().toISOString()
    const assigneeUserId = meta.requestedByUserId
    const next = this.appendAudit(
      {
        ...meta,
        status: 'in_progress',
        assigneeUserId,
        startedAt: meta.startedAt ?? now,
        requestedByUserId: undefined,
      },
      userId,
      'approve_request',
      'requested',
      'in_progress',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'approve_request',
      conversationId: message.conversationId,
    })
  }

  async rejectTaskRequest(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can reject requests')
    }
    if (meta.status !== 'requested') {
      throw new ValidationError('No pending task request')
    }

    const next = this.appendAudit(
      {
        ...meta,
        status: 'available',
        assigneeUserId: null,
        requestedByUserId: undefined,
      },
      userId,
      'reject_request',
      'requested',
      'available',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'reject_request',
      conversationId: message.conversationId,
    })
  }

  async completeTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.status !== 'in_progress') {
      throw new ValidationError('Task is not in progress')
    }
    const isReporter = meta.reporterUserId === userId
    const isAssignee = meta.assigneeUserId === userId
    if (!isReporter && !isAssignee) {
      throw new ValidationError('Only reporter or assignee can mark task done')
    }

    const now = new Date().toISOString()
    const next = this.appendAudit(
      {
        ...meta,
        status: 'completed',
        completedAt: now,
      },
      userId,
      'complete',
      'in_progress',
      'completed',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'complete',
      conversationId: message.conversationId,
    })
  }

  async acceptTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can accept completed work')
    }
    if (meta.status !== 'completed') {
      throw new ValidationError('Task is not completed')
    }

    const now = new Date().toISOString()
    let next = this.appendAudit(
      {
        ...meta,
        status: 'accepted',
        acceptedAt: now,
      },
      userId,
      'accept',
      'completed',
      'accepted',
    )

    next = await this.escrow.releaseOnAccept(messageId, next)

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'accept',
      conversationId: message.conversationId,
    })
  }

  async disputeTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can dispute completed work')
    }
    if (meta.status !== 'completed') {
      throw new ValidationError('Task is not completed')
    }

    const now = new Date().toISOString()
    const next = this.appendAudit(
      {
        ...meta,
        status: 'disputed',
        disputedAt: now,
      },
      userId,
      'dispute',
      'completed',
      'disputed',
    )

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'dispute',
      conversationId: message.conversationId,
    })
  }

  async cancelTask(messageId: string, userId: string): Promise<Message> {
    const { meta, message } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can cancel a task')
    }
    // disputed allowed: resolve-cancel refunds held escrow to reporter
    if (!['available', 'requested', 'in_progress', 'disputed'].includes(meta.status)) {
      throw new ValidationError('Task cannot be canceled in its current state')
    }

    const now = new Date().toISOString()
    let next = this.appendAudit(
      {
        ...meta,
        status: 'canceled',
        canceledAt: now,
        requestedByUserId: undefined,
      },
      userId,
      'cancel',
      meta.status,
      'canceled',
    )

    next = await this.escrow.refundOnCancel(messageId, next, userId)

    return this.persistTaskUpdate(messageId, next, undefined, {
      actorUserId: userId,
      action: 'cancel',
      conversationId: message.conversationId,
    })
  }

  async editTaskContent(
    messageId: string,
    userId: string,
    content: string,
  ): Promise<Message> {
    const trimmed = content.trim()
    if (!trimmed) {
      throw new ValidationError('Task description is required')
    }

    const { meta } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can edit a task')
    }
    if (!canEditTask(meta)) {
      throw new ValidationError('Task cannot be edited in its current state')
    }

    const next = this.appendAudit(meta, userId, 'edit_content')
    return this.persistTaskUpdate(messageId, next, trimmed)
  }

  async deleteTask(messageId: string, userId: string): Promise<void> {
    const { meta } = await this.loadTask(messageId, userId)
    if (!canDeleteTask(meta, userId)) {
      throw new ValidationError('Task cannot be deleted in its current state')
    }

    await this.messages.deleteMessage(messageId)
  }

  buildInitialMetadata(input: {
    reporterUserId: string
    assigneeUserId?: string | null
    deadline?: string
    budget?: TaskMetadata['budget']
    escrowEnabled?: boolean
  }): TaskMetadata {
    const assigneeUserId = input.assigneeUserId ?? null
    const now = new Date().toISOString()
    const hasAssignee = Boolean(assigneeUserId)
    // Escrow stays pending until fundOnCreate succeeds (then held + enabled).
    const wantsEscrow = Boolean(input.escrowEnabled && input.budget)

    return {
      kind: 'task',
      reporterUserId: input.reporterUserId,
      assigneeUserId,
      status: hasAssignee ? 'in_progress' : 'available',
      deadline: input.deadline,
      budget: input.budget,
      escrow: wantsEscrow
        ? { enabled: true, paymentStatus: 'pending' }
        : { enabled: false, paymentStatus: 'none' },
      ...(hasAssignee ? { startedAt: now } : {}),
      audit: [
        this.auditEntry(
          input.reporterUserId,
          'create',
          undefined,
          hasAssignee ? 'in_progress' : 'available',
        ),
      ],
    }
  }

  async attachOpportunityId(
    messageId: string,
    userId: string,
    opportunityId: string,
  ): Promise<Message> {
    const { meta } = await this.loadTask(messageId, userId)
    if (meta.reporterUserId !== userId) {
      throw new ValidationError('Only the reporter can link an opportunity')
    }

    const next = this.appendAudit(
      {
        ...meta,
        opportunityId,
      },
      userId,
      'convert_opportunity',
    )

    return this.persistTaskUpdate(messageId, next)
  }

  normalizeTaskContent(content: string): string {
    const trimmed = content.trim()
    if (!trimmed) {
      return taskFallbackContent('Untitled task')
    }
    const firstLine = trimmed.split('\n')[0]?.trim()
    if (firstLine && trimmed.startsWith('Task:')) {
      return trimmed
    }
    return trimmed
  }
}
