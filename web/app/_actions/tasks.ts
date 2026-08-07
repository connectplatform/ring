'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { Message, TaskMetadata } from '@/features/chat/types'
import { TaskService } from '@/features/tasks/services/task-service'
import {
  taskEscrowService,
} from '@/features/tasks/services/task-escrow-service'
import { taskFallbackContent, taskFirstLine } from '@/features/tasks/types'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'

export interface TaskActionResult {
  success: boolean
  error?: string
  message?: string
  messageId?: string
  escrowId?: string
  needsCheckout?: boolean
  data?: Message
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: 'Authentication required' as const }
  }
  return { session, error: null }
}

function revalidateConversation(conversationId?: string) {
  revalidatePath('/[locale]/messages')
  revalidatePath('/[locale]/tasks')
  if (conversationId) {
    revalidatePath(`/[locale]/messages?c=${conversationId}`)
    revalidatePath(`/[locale]/tasks/${conversationId}`)
  }
}

export async function createTaskMessage(input: {
  conversationId: string
  content: string
  assigneeUserId?: string | null
  deadline?: string
  budget?: TaskMetadata['budget']
  escrowEnabled?: boolean
}): Promise<TaskActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const conversationId = String(input.conversationId || '').trim()
    if (!conversationId) {
      return { success: false, error: 'Conversation is required' }
    }

    const description = String(input.content || '').trim()
    if (!description) {
      return { success: false, error: 'Task description is required' }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const conversations = new ConversationService()
    const messages = new MessageService()
    const tasks = new TaskService()

    const conversation = await conversations.getConversationById(conversationId, session.user.id)
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    let assigneeUserId = input.assigneeUserId ?? null
    if (assigneeUserId === session.user.id) {
      assigneeUserId = null
    }
    if (assigneeUserId) {
      const isParticipant = conversation.participants.some((p) => p.userId === assigneeUserId)
      if (!isParticipant) {
        return { success: false, error: 'Assignee must be a conversation participant' }
      }
    }

    if (input.escrowEnabled && !input.budget) {
      return { success: false, error: 'Budget is required when escrow is enabled' }
    }

    const metadata = tasks.buildInitialMetadata({
      reporterUserId: session.user.id,
      assigneeUserId,
      deadline: input.deadline,
      budget: input.budget,
      escrowEnabled: Boolean(input.escrowEnabled && input.budget),
    })

    const content = tasks.normalizeTaskContent(description)
    const fallback = taskFallbackContent(taskFirstLine(content))
    const messageContent = content || fallback

    const message = await messages.sendMessage(
      {
        conversationId,
        content: messageContent,
        type: 'task',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      session.user.id,
      session.user.name || session.user.email || 'User',
      session.user.image || undefined,
    )

    if (input.escrowEnabled && input.budget) {
      const fundResult = await taskEscrowService.fundOnCreate({
        messageId: message.id,
        conversationId,
        reporterUserId: session.user.id,
        assigneeUserId,
        budget: input.budget,
        escrowEnabled: true,
      })

      if (!fundResult.success) {
        try {
          await messages.deleteMessage(message.id)
        } catch (deleteError) {
          logger.error('Failed to roll back task after escrow fund failure', {
            messageId: message.id,
            deleteError,
          })
        }
        return {
          success: false,
          error: fundResult.error ?? 'Failed to fund task escrow',
        }
      }

      revalidateConversation(conversationId)

      if (fundResult.needsCheckout) {
        return {
          success: true,
          message: 'Task created — complete checkout to fund escrow',
          messageId: message.id,
          escrowId: fundResult.escrowId,
          needsCheckout: true,
          data: fundResult.message ?? message,
        }
      }

      return {
        success: true,
        message: 'Task created',
        messageId: fundResult.message?.id ?? message.id,
        data: fundResult.message ?? message,
      }
    }

    revalidateConversation(conversationId)

    return {
      success: true,
      message: 'Task created',
      messageId: message.id,
      data: message,
    }
  } catch (error) {
    logger.error('createTaskMessage failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    }
  }
}

async function runTaskTransition(
  messageId: string,
  action: (tasks: TaskService, id: string, userId: string) => Promise<Message>,
): Promise<TaskActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const id = String(messageId || '').trim()
    if (!id) return { success: false, error: 'Message ID is required' }

    const tasks = new TaskService()
    const message = await action(tasks, id, session.user.id)
    revalidateConversation(message.conversationId)

    return { success: true, data: message }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Task action failed',
    }
  }
}

export async function startTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.startTask(id, userId))
}

export async function requestTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.requestTask(id, userId))
}

export async function approveTaskRequest(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) =>
    tasks.approveTaskRequest(id, userId),
  )
}

export async function rejectTaskRequest(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) =>
    tasks.rejectTaskRequest(id, userId),
  )
}

export async function completeTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.completeTask(id, userId))
}

export async function acceptTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.acceptTask(id, userId))
}

export async function disputeTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.disputeTask(id, userId))
}

export async function cancelTask(messageId: string): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) => tasks.cancelTask(id, userId))
}

export async function editTaskContent(
  messageId: string,
  content: string,
): Promise<TaskActionResult> {
  return runTaskTransition(messageId, (tasks, id, userId) =>
    tasks.editTaskContent(id, userId, content),
  )
}

export async function deleteTask(messageId: string): Promise<TaskActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const id = String(messageId || '').trim()
    if (!id) return { success: false, error: 'Message ID is required' }

    const tasks = new TaskService()
    const { message } = await tasks.loadTask(id, session.user.id)
    await tasks.deleteTask(id, session.user.id)
    revalidateConversation(message.conversationId)

    return { success: true, message: 'Task deleted' }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete task',
    }
  }
}

export async function convertTaskToOpportunity(messageId: string): Promise<TaskActionResult & {
  opportunityId?: string
}> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const id = String(messageId || '').trim()
    if (!id) return { success: false, error: 'Message ID is required' }

    const tasks = new TaskService()
    const { message, meta } = await tasks.loadTask(id, session.user.id)

    if (meta.reporterUserId !== session.user.id) {
      return { success: false, error: 'Only the reporter can convert a task' }
    }

    if (meta.status === 'canceled') {
      return { success: false, error: 'Canceled tasks cannot be converted' }
    }

    if (meta.opportunityId) {
      return {
        success: true,
        opportunityId: meta.opportunityId,
        message: 'Task already linked to an opportunity',
        data: message,
      }
    }

    const content = message.content.trim()
    const title = taskFirstLine(content)
    const briefDescription = content.slice(0, 500) || title
    const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { createOpportunity } = await import(
      '@/features/opportunities/services/create-opportunity'
    )

    const opportunity = await createOpportunity({
      type: 'request',
      title,
      isConfidential: false,
      briefDescription,
      fullDescription: content,
      createdBy: session.user.id,
      organizationId: '',
      expirationDate,
      status: 'pending',
      category: 'General',
      tags: [
        'chat_task',
        `sourceMessageId:${id}`,
        `sourceConversationId:${message.conversationId}`,
        'sourceTaskKind:chat_task',
      ],
      location: '',
      requiredSkills: [],
      requiredDocuments: [],
      attachments: [],
      visibility: 'subscriber',
      contactInfo: {
        linkedEntity: '',
        contactAccount: session.user.email || session.user.id,
      },
      applicantCount: 0,
      isPrivate: true,
      ...(meta.budget
        ? {
            budget: {
              min: meta.budget.amount,
              max: meta.budget.amount,
              currency: meta.budget.currencyCode || getMainCurrencySymbol(),
            },
          }
        : {}),
    } as any)

    const updated = await tasks.attachOpportunityId(id, session.user.id, opportunity.id)
    revalidateConversation(message.conversationId)
    revalidatePath('/[locale]/opportunities/my')

    return {
      success: true,
      message: 'Task converted to opportunity',
      opportunityId: opportunity.id,
      data: updated,
    }
  } catch (err) {
    logger.error('convertTaskToOpportunity failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to convert task',
    }
  }
}
