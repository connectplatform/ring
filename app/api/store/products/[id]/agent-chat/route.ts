import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ProductAgentService } from '@/features/store/services/product-agent-service'
import { z } from 'zod'

const postSchema = z.object({
  content: z.string().trim().min(1).max(4000),
})

const productAgentService = new ProductAgentService()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: productId } = await params
    const product = await productAgentService.loadProduct(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const conversation = await productAgentService.getOrCreateConversation(session.user.id, product)

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
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid message', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const result = await productAgentService.sendMessage(
      session.user.id,
      userName,
      productId,
      parsed.data.content,
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('POST /api/store/products/[id]/agent-chat failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to send message'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
