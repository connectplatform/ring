import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { z } from 'zod'

/**
 * Legacy alias for POST /api/admin/orders/[id]/status.
 * Path has no [id] segment — orderId must come from the JSON body.
 * Prefer /api/admin/orders/[id]/status or the updateOrderStatus server action.
 */
export async function POST(req: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const schema = z.object({
      orderId: z.string().min(1),
      status: z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled']),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Bad request',
          hint: 'Pass { orderId, status } or use POST /api/admin/orders/[id]/status',
        },
        { status: 400 },
      )
    }

    await StoreOrdersService.adminUpdateOrderStatus(
      parsed.data.orderId,
      parsed.data.status,
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    )
  }
}
