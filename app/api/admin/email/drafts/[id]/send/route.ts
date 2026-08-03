import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { sendDraftReply } from '@/features/email-crm/services/email-send-orchestrator'

// POST endpoint to send an email draft, given its ID
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Establish a database connection (if not already connected)
  await connection()

  // Authenticate the user as an email admin
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // If authentication fails, respond with the error and proper status code
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse the request body as JSON; default to empty object if error occurs
  const body = await req.json().catch(() => ({}))

  // Extract 'id' parameter from request - (params is a Promise, need to await)
  // TODO: When using Next.js 16+ Route Handlers, consider using new dynamic segment param access
  const { id } = await params

  // Fetch the draft email by ID. If not found, return 404 error.
  const draft = await getEmailDraftService().getDraft(id)
  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Retrieve the email thread associated with the draft.
  const thread = await EmailThreadService.getThread(draft.threadId)

  // Determine recipient email address: prefer explicit body value, fallback to thread data
  const toEmail = body.toEmail ?? thread?.fromEmail

  // Compose the email subject: prefer explicit body value, fallback to thread subject or default
  const subject = body.subject ?? thread?.subject ?? 'Re: your inquiry'

  // Ensure a toEmail target exists; if not, respond with 400 error
  if (!toEmail) {
    return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })
  }

  // Send the draft reply email (soft-skips when client prefers in-app chat)
  const result = await sendDraftReply({
    draftId: id,
    toEmail,
    subject,
    threadId: draft.threadId,
    inReplyTo: draft.messageId,
    wasAutoSent: false,
  })

  if (result.skipped) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: result.reason,
      notice: result.notice,
      supportConversationId: thread?.supportConversationId ?? null,
      threadId: draft.threadId,
    })
  }

  // Respond with success and the new messageId
  return NextResponse.json({ success: true, messageId: result.messageId })
}
