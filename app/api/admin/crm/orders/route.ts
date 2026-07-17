import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import type { ProjectWorkStatus } from '@/features/crm/orders/types'

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
