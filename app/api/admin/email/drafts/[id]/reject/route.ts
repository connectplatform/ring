import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'

// Handle rejection of an email draft by POST request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Ensure DB connection is established before proceeding
  await connection()

  // Authenticate and authorize user as email admin
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // User is not authorized; return error response and status
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse JSON body for reason; fallback to empty object if body invalid/missing
  const body = await req.json().catch(() => ({}))

  // Await route params and retrieve draft ID from URL
  const { id } = await params

  // Attempt to reject the draft using the associated service, passing reason if provided
  const draft = await getEmailDraftService().rejectDraft(
    id,
    authResult.session.user.id,
    body.reason as string | undefined
  )

  // Return the updated draft as response JSON
  return NextResponse.json({ draft })
  // TODO: With Next.js 13/14/16, consider handling errors with structured error responses and middleware (e.g., NextResponse.error or error boundary for async routes)
  // TODO: Consider validating the request body schema, e.g., with Zod, and return 400 for malformed requests
  // TODO: Use Route Handler `params` natively as a plain object (supported in recent Next.js versions) instead of possibly Promise-based signature
}
