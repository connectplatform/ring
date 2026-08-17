import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'

/** Human-only: log that an admin requested unsubscribe (no HTTP click). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const by =
    authResult.session?.user?.email ||
    authResult.session?.user?.id ||
    'admin'
  const thread = await EmailThreadService.logUnsubscribeRequest(id, String(by))
  if (!thread) {
    return NextResponse.json(
      { error: 'Thread not found or missing unsubscribeUrl' },
      { status: 404 }
    )
  }
  return NextResponse.json({ thread })
}
