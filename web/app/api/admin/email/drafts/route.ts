import { NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'

// Handles GET requests to fetch pending email drafts for admins.
export async function GET() {
  // Establishes database connection before performing any db operations.
  await connection()

  // Ensures that the requester is an email admin.
  // Returns early with error response if not authorized.
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  // Fetches up to 100 pending email drafts using the email draft service.
  // TODO: Consider making the draft limit configurable or accepting limit as query param.
  // TODO: If large lists, consider pagination and streaming response (React 19/Next 16 supports).
  const drafts = await getEmailDraftService().getPendingDrafts(100)

  // Responds with the list of drafts in JSON format.
  return NextResponse.json({ drafts })
}
