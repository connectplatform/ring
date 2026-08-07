/**
 * GET/POST /api/vendor/dagi/chat — vendor DAGI ERP agent (session + bound vendorEntityId).
 * Never trusts model/client uid; vendorEntityId must be owned + hasFeatureForVendor.
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { DagiAgentService } from '@/features/store/services/dagi-agent-service'
import { encodeSse, SSE_HEADERS } from '@/lib/sse/encode-sse'
import { z } from 'zod'

const postSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  vendorEntityId: z.string().trim().min(1),
  stream: z.boolean().optional(),
})

const dagiAgentService = new DagiAgentService()

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vendorEntityId = request.nextUrl.searchParams.get('vendorEntityId')?.trim() || ''
    if (!vendorEntityId) {
      return NextResponse.json({ error: 'vendorEntityId required' }, { status: 400 })
    }

    const bound = await dagiAgentService.resolveBoundVendor(session.user.id, vendorEntityId)
    if (!bound) {
      return NextResponse.json(
        { error: 'DAGI not unlocked for this vendor store' },
        { status: 403 },
      )
    }

    const conversation = await dagiAgentService.getOrCreateConversation(
      session.user.id,
      bound.vendorEntityId,
      bound.vendorName,
    )

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        vendorEntityId: bound.vendorEntityId,
        vendorName: bound.vendorName,
        subject: conversation.metadata.subject || `DAGI — ${bound.vendorName}`,
      },
    })
  } catch (error) {
    console.error('GET /api/vendor/dagi/chat failed:', error)
    return NextResponse.json({ error: 'Failed to load DAGI chat' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid message', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Security: ignore any client-supplied identity fields
    if (body?.userId || body?.uid || body?.asUserId) {
      console.warn('[dagi/chat] ignored client identity fields', {
        sessionUserId: session.user.id,
      })
    }

    const userName =
      session.user.name?.trim() ||
      session.user.email?.split('@')[0] ||
      'Vendor'

    const wantsStream =
      parsed.data.stream === true ||
      request.headers.get('accept')?.includes('text/event-stream')

    const context = await dagiAgentService.beginSendMessage({
      sessionUserId: session.user.id,
      userName,
      vendorEntityId: parsed.data.vendorEntityId,
      content: parsed.data.content,
    })

    if (!wantsStream) {
      const toolTurn = await dagiAgentService.generateWithDagiTools({
        sessionUserId: session.user.id,
        vendorEntityId: context.vendorEntityId,
        systemPrompt: context.systemPrompt,
        historyMessages: context.streamMessages,
        userContent: parsed.data.content,
      })
      const text = toolTurn?.text || context.fallbackReply
      const completed = await dagiAgentService.completeAgentMessage(
        context.conversation.id,
        text,
        context.fallbackReply,
      )
      return NextResponse.json({
        success: true,
        data: {
          conversation: context.conversation,
          userMessage: context.userMessage,
          agentMessage: completed.agentMessage,
          toolsUsed: toolTurn?.toolsUsed || [],
        },
      })
    }

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''
        try {
          controller.enqueue(
            encodeSse({
              type: 'userMessage',
              message: context.userMessage,
              conversation: context.conversation,
            }),
          )

          const toolTurn = await dagiAgentService.generateWithDagiTools({
            sessionUserId: session.user.id,
            vendorEntityId: context.vendorEntityId,
            systemPrompt: context.systemPrompt,
            historyMessages: context.streamMessages,
            userContent: parsed.data.content,
          })

          if (toolTurn) {
            if (toolTurn.toolsUsed.length > 0) {
              controller.enqueue(
                encodeSse({
                  type: 'tool_status',
                  tools: toolTurn.toolsUsed,
                  message: 'Running ERP tools…',
                }),
              )
            }
            fullContent = toolTurn.text || context.fallbackReply
            if (fullContent) {
              controller.enqueue(encodeSse({ type: 'token', content: fullContent }))
            }
          } else {
            const llm = await dagiAgentService.createStreamingClient()
            for await (const chunk of llm.streamMessages(context.streamMessages, {
              system: context.systemPrompt,
              maxTokens: 800,
              temperature: 0.3,
            })) {
              if (chunk.type === 'token' && chunk.content) {
                fullContent += chunk.content
                controller.enqueue(encodeSse({ type: 'token', content: chunk.content }))
              } else if (chunk.type === 'error') {
                controller.enqueue(encodeSse({ type: 'error', error: chunk.error }))
                break
              }
            }
            if (!fullContent.trim()) fullContent = context.fallbackReply
          }

          const completed = await dagiAgentService.completeAgentMessage(
            context.conversation.id,
            fullContent,
            context.fallbackReply,
          )

          controller.enqueue(
            encodeSse({
              type: 'done',
              agentMessage: completed.agentMessage,
              conversation: context.conversation,
              toolsUsed: toolTurn?.toolsUsed || [],
            }),
          )
        } catch (error) {
          controller.enqueue(
            encodeSse({
              type: 'error',
              error: error instanceof Error ? error.message : 'DAGI chat failed',
            }),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, { headers: SSE_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send DAGI message'
    const status =
      message.toLowerCase().includes('not unlocked') || message.toLowerCase().includes('unauthorized')
        ? 403
        : 500
    console.error('POST /api/vendor/dagi/chat failed:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
