import { NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'

export async function GET() {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const drafts = await getEmailDraftService().getPendingDrafts(100)
  return NextResponse.json({ drafts })
}
