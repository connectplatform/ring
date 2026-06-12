import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json().catch(() => ({}))
  const { id } = await params
  const draft = await getEmailDraftService().rejectDraft(
    id,
    authResult.session.user.id,
    body.reason as string | undefined
  )
  return NextResponse.json({ draft })
}
