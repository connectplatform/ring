import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ProductAgentService } from '@/features/store/services/product-agent-service'
import { resolveServerLocale } from '@/lib/i18n/resolve-server-locale'
import { encodeSse, SSE_HEADERS } from '@/lib/sse/encode-sse'
import { z } from 'zod'

const postSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  stream: z.boolean().optional(),
})

const productAgentService = new ProductAgentService()

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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userName =
      session.user.name?.trim() ||
      session.user.email?.split('@')[0] ||
      'Customer'

    const { id: productId } = await params
    const locale = await resolveServerLocale(request, { userId: session.user.id })
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid message', details: parsed.error.issues },
        { status: 400 },
      )
    }

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

    const llm = productAgentService.createStreamingClient()
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

          const agentMessage = await productAgentService.completeAgentMessage(
            context.conversation.id,
            fullContent,
            locale,
          )

          controller.enqueue(
            encodeSse({
              type: 'done',
              agentMessage,
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
