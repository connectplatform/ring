import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import type { CalculatorInputs } from '@/features/calculator/types'
import type { ProjectWorkStatus } from '@/features/crm/orders/types'

const createSchema = z.object({
  userId: z.string().min(1),
  inputs: z.object({
    niche: z.string().min(1),
    scale: z.string().min(1),
    modules: z.array(z.string()),
    externals: z.array(z.string()).default([]),
    hosting: z.string().min(1),
    branding: z.boolean().default(false),
    needHumanDev: z.boolean().default(true),
  }),
  markPaid: z.boolean().optional(),
  orderReference: z.string().optional(),
})

export async function GET(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const workStatus = request.nextUrl.searchParams.get('workStatus') as ProjectWorkStatus | null
  const orders = await ProjectOrderService.listAdmin({
    workStatus: workStatus || undefined,
  })
  return NextResponse.json({ success: true, orders })
}

/** Admin create — same CalculatorInputs → createDraft path as /api/calculator/orders. */
export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  try {
    const body = createSchema.parse(await request.json())
    const inputs = body.inputs as CalculatorInputs
    let order = await ProjectOrderService.createDraft(body.userId, inputs)
    if (body.markPaid) {
      const ref =
        body.orderReference?.trim() ||
        `admin_comp_${session.user.id.slice(0, 8)}_${Date.now()}`
      order = await ProjectOrderService.markPaid(order.id, ref)
    }
    return NextResponse.json({ success: true, orderId: order.id, order })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
