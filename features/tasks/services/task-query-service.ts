import { db } from '@/lib/database'
import { getConversationTitle } from '@/features/chat/lib/conversation-display'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'
import { ConversationService } from '@/features/chat/services/conversation-service'
import type { Message, TaskStatus } from '@/features/chat/types'
import { parseTaskMetadata } from '@/features/tasks/types'

export type TaskTreeFilter = 'all' | 'available' | 'in_progress' | 'completed'

const MAX_TASKS_TOTAL = 21
const MAX_TASKS_PER_CHAT = 3

export interface TaskConversationGroup {
  conversationId: string
  title: string
  tasks: Message[]
}

function matchesFilter(status: TaskStatus, filter: TaskTreeFilter): boolean {
  switch (filter) {
    case 'available':
      return status === 'available' || status === 'requested'
    case 'in_progress':
      return status === 'in_progress'
    case 'completed':
      return status === 'completed' || status === 'accepted'
    case 'all':
    default:
      return true
  }
}

async function queryTaskMessagesForConversation(
  conversationId: string,
  limit: number,
): Promise<Message[]> {
  const result = await db().queryDocs<Message>({
    collection: 'messages',
    filters: [
      { field: 'conversationId', operator: '==', value: conversationId },
      { field: 'type', operator: '==', value: 'task' },
    ],
    orderBy: [{ field: 'timestamp', direction: 'desc' }],
    pagination: { limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  return result.data
}

export async function listTaskTreeForUser(
  userId: string,
  filter: TaskTreeFilter = 'all',
): Promise<{ conversations: TaskConversationGroup[] }> {
  const conversationsService = new ConversationService()
  const conversations = await conversationsService.getConversations(userId, undefined, {
    limit: 100,
  })

  const flat: Array<{
    conversationId: string
    title: string
    message: Message
    timestamp: number
  }> = []

  for (const conversation of conversations) {
    const title = getConversationTitle(conversation, userId)
    const messages = await queryTaskMessagesForConversation(conversation.id, 50)
    let perChat = 0

    for (const message of messages) {
      const meta = parseTaskMetadata(message)
      if (!meta || !matchesFilter(meta.status, filter)) continue
      if (perChat >= MAX_TASKS_PER_CHAT) break

      flat.push({
        conversationId: conversation.id,
        title,
        message,
        timestamp: getMessageTimeMs(message.timestamp),
      })
      perChat += 1
    }
  }

  flat.sort((a, b) => b.timestamp - a.timestamp)
  const capped = flat.slice(0, MAX_TASKS_TOTAL)

  const groupOrder: string[] = []
  const groups = new Map<string, TaskConversationGroup>()

  for (const item of capped) {
    let group = groups.get(item.conversationId)
    if (!group) {
      group = {
        conversationId: item.conversationId,
        title: item.title,
        tasks: [],
      }
      groups.set(item.conversationId, group)
      groupOrder.push(item.conversationId)
    }
    group.tasks.push(item.message)
  }

  return {
    conversations: groupOrder
      .map((id) => groups.get(id))
      .filter((group): group is TaskConversationGroup => Boolean(group)),
  }
}

export async function listTasksForConversation(
  userId: string,
  conversationId: string,
  filter: TaskTreeFilter = 'all',
): Promise<Message[]> {
  const conversationsService = new ConversationService()
  const conversation = await conversationsService.getConversationById(conversationId, userId)
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const messages = await queryTaskMessagesForConversation(conversationId, 200)

  return messages.filter((message) => {
    const meta = parseTaskMetadata(message)
    if (!meta) return false
    return matchesFilter(meta.status, filter)
  })
}
