import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ProductAgentService } from '@/features/store/services/product-agent-service'
import {
  consumeGuestAgentQuota,
  guestAgentRateLimitKey,
} from '@/features/store/lib/guest-agent-rate-limit'
import { resolveServerLocale } from '@/lib/i18n/resolve-server-locale'
import { encodeSse, SSE_HEADERS } from '@/lib/sse/encode-sse'
import { z } from 'zod'

const postSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  stream: z.boolean().optional(),
  /** Anonymous PDP Q&A — limited tokens, productAgent-only, no MCP / no persist */
  guest: z.boolean().optional(),
})

const productAgentService = new ProductAgentService()

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: productId } = await params
    const locale = await resolveServerLocale(request, { userId: session.user.id })
    const product = await productAgentService.loadProduct(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const conversation = await productAgentService.getOrCreateConversation(
      session.user.id,
      product,
      locale,
    )

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        subject: conversation.metadata.subject || product.name,
      },
    })
  } catch (error) {
    console.error('GET /api/store/products/[id]/agent-chat failed:', error)
    return NextResponse.json({ error: 'Failed to load product chat' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const { id: productId } = await params
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid message', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const session = await auth()

    // Guest PDP Q&A when unauthenticated (or explicit guest:true).
    // No conversation persist, no MCP. Ignore any client/model-supplied uid.
    if (!session?.user?.id || parsed.data.guest === true) {
      const localeForGuest = await resolveServerLocale(request)
      const quota = consumeGuestAgentQuota(
        guestAgentRateLimitKey(clientIp(request), productId),
      )
      if (!quota.ok) {
        return NextResponse.json(
          {
            error: 'Guest limit reached for this product. Sign in to continue.',
            code: 'GUEST_LIMIT',
            resetAt: quota.resetAt,
          },
          { status: 429 },
        )
      }

      const result = await productAgentService.answerGuestQuestion(
        productId,
        parsed.data.content.slice(0, 500),
        localeForGuest,
      )

      return NextResponse.json({
        success: true,
        data: {
          guest: true,
          reply: result.reply,
          productName: result.productName,
          remaining: quota.remaining,
        },
      })
    }

    const userName =
      session.user.name?.trim() ||
      session.user.email?.split('@')[0] ||
      'Customer'

    const locale = await resolveServerLocale(request, { userId: session.user.id })

    const wantsStream =
      parsed.data.stream === true ||
      request.headers.get('accept')?.includes('text/event-stream')

    if (!wantsStream) {
      const result = await productAgentService.sendMessage(
        session.user.id,
        userName,
        productId,
        parsed.data.content,
        locale,
      )

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    const context = await productAgentService.beginSendMessage(
      session.user.id,
      userName,
      productId,
      parsed.data.content,
      locale,
    )

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

          // Prefer Anthropic tool_use loop (session-bound commerce). Fallback: text stream.
          const toolTurn = await productAgentService.generateWithCommerceTools({
            sessionUserId: session.user.id,
            productId,
            locale,
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
                  message: 'Updating cart…',
                }),
              )
            }
            fullContent = toolTurn.text || context.fallbackReply
            // Emit as one token burst for existing client parsers
            if (fullContent) {
              controller.enqueue(encodeSse({ type: 'token', content: fullContent }))
            }

            const completed = await productAgentService.completeAgentMessage(
              context.conversation.id,
              fullContent,
              locale,
              { defaultProductId: productId },
            )

            controller.enqueue(
              encodeSse({
                type: 'done',
                agentMessage: completed.agentMessage,
                productCardMessages: completed.productCardMessages,
                conversation: context.conversation,
                usage: chunkUsage(fullContent),
                navigateTo: toolTurn.redirectTo,
                cartUpdated: toolTurn.cartUpdated,
              }),
            )
            return
          }

          const llm = await productAgentService.createStreamingClient()

          for await (const chunk of llm.streamMessages(context.streamMessages, {
            system: context.systemPrompt,
            maxTokens: 600,
            temperature: 0.35,
          })) {
            if (chunk.type === 'token' && chunk.content) {
              fullContent += chunk.content
              controller.enqueue(encodeSse({ type: 'token', content: chunk.content }))
            } else if (chunk.type === 'error') {
              controller.enqueue(encodeSse({ type: 'error', error: chunk.error }))
              break
            }
          }

          const completed = await productAgentService.completeAgentMessage(
            context.conversation.id,
            fullContent,
            locale,
            { defaultProductId: productId },
          )

          controller.enqueue(
            encodeSse({
              type: 'done',
              agentMessage: completed.agentMessage,
              productCardMessages: completed.productCardMessages,
              conversation: context.conversation,
              usage: chunkUsage(fullContent),
            }),
          )
        } catch (error) {
          console.error('POST /api/store/products/[id]/agent-chat stream failed:', error)
          controller.enqueue(
            encodeSse({
              type: 'error',
              error: error instanceof Error ? error.message : 'Stream failed',
            }),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch (error) {
    console.error('POST /api/store/products/[id]/agent-chat failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to send message'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

function chunkUsage(content: string) {
  return {
    completionTokens: Math.ceil(content.length / 4),
  }
}
