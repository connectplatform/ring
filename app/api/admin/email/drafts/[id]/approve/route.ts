import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'

// Handle POST requests to approve an email draft
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Ensure a DB connection is established before proceeding
  await connection()

  // Require the current user to have email admin privileges
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // If not authorized, return the error and appropriate HTTP status
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Await the draft id from the route parameters (dynamic API route)
  // TODO: When possible with Next.js Route Handlers, use destructured params argument directly instead of a promise for improved clarity.
  const { id } = await params

  // Try to approve the specified email draft as the current user
  // TODO: Add error handling if draft approval fails (e.g., draft not found, already approved)
  const draft = await getEmailDraftService().approveDraft(id, authResult.session.user.id)

  // Return the approved draft in the response
  return NextResponse.json({ draft })
  // TODO: With Next.js 13/14/16, consider handling errors with structured error responses and middleware (e.g., NextResponse.error or error boundary for async routes)
  // TODO: Consider validating the request body schema, e.g., with Zod, and return 400 for malformed requests
  // TODO: Use Route Handler `params` natively as a plain object (supported in recent Next.js versions) instead of possibly Promise-based signature
}
