import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'

/**
 * GET /api/my-orders — list project orders for the authenticated buyer/owner.
 */
export async function GET() {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const orders = await ProjectOrderService.listForUser(session.user.id)
  return NextResponse.json({ success: true, orders })
}
