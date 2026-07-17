import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import type { CalculatorInputs } from '@/features/calculator/types'

const schema = z.object({
  niche: z.string(),
  scale: z.string(),
  modules: z.array(z.string()),
  externals: z.array(z.string()),
  hosting: z.string(),
  branding: z.boolean(),
  needHumanDev: z.boolean(),
})

export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = schema.parse(await request.json())
    const inputs = body as CalculatorInputs
    if (!inputs.niche || !inputs.scale || !inputs.hosting) {
      return NextResponse.json(
        { error: 'niche, scale, and hosting are required' },
        { status: 400 },
      )
    }

    const order = await ProjectOrderService.createDraft(session.user.id, inputs)
    return NextResponse.json({ success: true, orderId: order.id, order })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
