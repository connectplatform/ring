import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'
import { getEmailTaskService } from '@/services/email/crm/task-service'

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
  // TODO: Consider Promise.all to parallelize requests for better performance.
  const messages = await EmailMessageService.listByThread(id)
  const drafts = await getEmailDraftService().getThreadDrafts(id)
  const tasks = await getEmailTaskService().getThreadTasks(id)

  // Respond with thread data structure containing all pieces.
  return NextResponse.json({ thread, messages, drafts, tasks })
}
