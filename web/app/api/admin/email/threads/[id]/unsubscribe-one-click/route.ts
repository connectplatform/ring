import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import {
  isUnsubscribeUrlAllowlisted,
  postRfc8058Unsubscribe,
} from '@/features/email-crm/lib/unsubscribe-rfc8058'
import { getConfiguredUnsubscribeAllowHosts } from '@/features/email-crm/lib/unsubscribe-allow-hosts'

/** Admin retry: RFC 8058 POST only when oneClick + allowlisted. Never GET. */
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
  const thread = await EmailThreadService.getThread(id)
  if (!thread?.unsubscribeUrl) {
    return NextResponse.json(
      { error: 'Thread not found or missing unsubscribeUrl' },
      { status: 404 }
    )
  }
  const allowHosts = getConfiguredUnsubscribeAllowHosts()
  if (!thread.unsubscribeOneClick || !isUnsubscribeUrlAllowlisted(thread.unsubscribeUrl, allowHosts)) {
    return NextResponse.json(
      { error: 'One-click POST is not eligible for this thread' },
      { status: 400 }
    )
  }

  const by =
    authResult.session?.user?.email ||
    authResult.session?.user?.id ||
    'admin-email'
  const posted = await postRfc8058Unsubscribe(thread.unsubscribeUrl, { allowHosts })
  const updated = await EmailThreadService.logUnsubscribeRequest(id, String(by), {
    method: 'rfc8058-post',
    status: posted.status,
    httpStatus: posted.httpStatus,
    error: posted.error,
    url: posted.url,
  })
  if (!updated) {
    return NextResponse.json({ error: 'Failed to log RFC 8058 POST' }, { status: 500 })
  }
  return NextResponse.json({ thread: updated, result: posted })
}
