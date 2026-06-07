import { MessageService } from '@/features/chat/services/message-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const POST = withMcpGuard(async (request, actor) => {
  const body = await readJsonBody(request)
  if (!body?.conversationId) return mcpError('conversationId is required', 400)
  if (!body?.content) return mcpError('content is required', 400)

  const service = new MessageService()
  const message = await service.sendMessage(
    {
      conversationId: String(body.conversationId),
      content: String(body.content),
      attachments: body.attachments as any,
      replyTo: body.replyTo as string | undefined,
    },
    String(body.senderId || actor.id),
    String(body.senderName || actor.name || 'Ring MCP'),
    body.senderAvatar as string | undefined
  )

  return mcpOk(message, 201)
})
