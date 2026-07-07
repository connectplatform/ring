import { z } from 'zod'
import { MessageService } from '@/features/chat/services/message-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// ---------------------------------------------------------------------------
// Send-message schema — validates the required fields and typed attachments.
// Attachment shape matches Omit<MessageAttachment, 'id'> from chat types.
// ---------------------------------------------------------------------------
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
 * POST handler for sending a new message in a conversation.
 * Uses withMcpGuard for authentication and authorization middleware.
 * Reads request body, validates with Zod, and delegates to MessageService.
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
