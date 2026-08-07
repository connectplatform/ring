import { MessageService } from '@/features/chat/services/message-service'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { z } from 'zod'

const attachmentSchema = z.object({
  type: z.enum(['image', 'file', 'document']),
  url: z.string(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
}).passthrough()

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  content: z.string().min(1, 'content is required'),
  attachments: z.array(attachmentSchema).optional(),
  replyTo: z.string().optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  senderAvatar: z.string().optional(),
}).passthrough()

/**
 * GET — list messages for a conversation (Reggie poller).
 * Query: conversationId (required), since (ISO timestamp, optional), limit (default 50).
 * Auth: RING_MCP_ACCESS_KEY via withMcpGuard.
 */
export const GET = withMcpGuard(async (request, actor) => {
  const conversationId = queryString(request, 'conversationId')
  if (!conversationId) {
    return mcpError('conversationId query parameter is required', 400)
  }

  const limit = queryInt(request, 'limit', 50) || 50
  const since = queryString(request, 'since')

  const conversationService = new ConversationService()
  const conversation = await conversationService.getConversationById(
    conversationId,
    actor.id,
  ).catch(() => null)

  // Allow override senderId as participant check — Reggie may poll as actor or as ring-reggie-agent
  const asUser = queryString(request, 'asUserId') || actor.id
  let allowed = false
  if (conversation) {
    allowed = conversation.participants.some(
      (p) => p.userId === asUser || p.userId === actor.id,
    )
  }
  if (!allowed) {
    // Re-fetch without user gate if ConversationService requires membership
    try {
      const service = new MessageService()
      const messages = await service.getMessages(conversationId, asUser, { limit })
      const filtered = since
        ? messages.filter((m) => new Date(m.timestamp).getTime() > new Date(since).getTime())
        : messages
      return mcpOk({ items: filtered, total: filtered.length, conversationId })
    } catch {
      return mcpError('Access denied to conversation or not found', 403)
    }
  }

  const service = new MessageService()
  try {
    const messages = await service.getMessages(conversationId, asUser, { limit })
    const filtered = since
      ? messages.filter((m) => new Date(m.timestamp).getTime() > new Date(since).getTime())
      : messages
    return mcpOk({ items: filtered, total: filtered.length, conversationId })
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : 'Failed to list messages', 500)
  }
})

/**
 * POST — send a message (existing). Supports senderId override for agents.
 */
export const POST = withMcpGuard(async (request, actor) => {
  const body = await readJsonBody(request)
  const parsed = sendMessageSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  const data = parsed.data
  const service = new MessageService()

  const message = await service.sendMessage(
    {
      conversationId: data.conversationId,
      content: data.content,
      attachments: data.attachments as Parameters<typeof service.sendMessage>[0]['attachments'],
      replyTo: data.replyTo,
    },
    data.senderId || actor.id,
    data.senderName || actor.name || 'Ring MCP',
    data.senderAvatar,
  )

  return mcpOk(message, 201)
})
