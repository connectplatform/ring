import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import { isUnsubscribeUrlAllowlisted } from '@/features/email-crm/lib/unsubscribe-rfc8058'
import { getConfiguredUnsubscribeAllowHosts } from '@/features/email-crm/lib/unsubscribe-allow-hosts'

// Handles GET requests to fetch an email thread, its messages, drafts, and tasks.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // params is a promise, due to dynamic route handling
) {
  await connection() // Ensure DB connection for each request. 
  // TODO: Consider using Next.js middleware or server-side context for more efficient DB connection pooling.

  // Check for required email admin privileges
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    // Return early if not authorized
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Await params promise to get the route id (thread id)
  const { id } = await params

  // Fetch the thread data by id
  const thread = await EmailThreadService.getThread(id)
  if (!thread) {
    // Return 404 if thread not found
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  // Fetch related messages, drafts, and tasks for given thread concurrently for performance.
  const [messages, drafts, tasks] = await Promise.all([
    EmailMessageService.listByThread(id),
    getEmailDraftService().getThreadDrafts(id),
    getEmailTaskService().getThreadTasks(id),
  ])

  const unsubscribeOneClickEligible = Boolean(
    thread.unsubscribeOneClick &&
      thread.unsubscribeUrl &&
      isUnsubscribeUrlAllowlisted(thread.unsubscribeUrl, getConfiguredUnsubscribeAllowHosts())
  )

  return NextResponse.json({
    thread: { ...thread, unsubscribeOneClickEligible },
    messages,
    drafts,
    tasks,
  })
}
