import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { EmailThreadService, type EmailThreadStatus } from '@/features/email-crm/services/email-thread-service'

export async function GET(req: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status') as EmailThreadStatus | null
  const threads = await EmailThreadService.listThreads({
    status: status && status !== ('all' as string) ? status : undefined,
    limit: 100,
  })

  return NextResponse.json({ threads })
}

export async function PATCH(req: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 })
  }

  const updated = await EmailThreadService.updateStatus(body.id, body.status)
  if (!updated) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
