import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'

/**
 * Handles GET requests for email tasks.
 * - Establishes DB connection.
 * - Checks admin permissions.
 * - Retrieves tasks, with optional filtering by status and a default limit of 100.
 */
export async function GET(req: NextRequest) {
  await connection() // ensure database connection is established
  const authResult = await requireEmailAdmin() // check if the user is an email admin

  // If user is not authorized, return an appropriate error and status
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const chip = url.searchParams.get('chip')
  const taskTypeParam = url.searchParams.get('taskType')

  const chipTaskType =
    chip === 'unsubscribe'
      ? 'unsubscribe_pending'
      : taskTypeParam || undefined

  let tasks = await getEmailTaskService().searchTasks({
    status: status ? (status as never) : undefined,
    taskType: (chipTaskType as never) || undefined,
    limit: chip === 'lead' || chip === 'osint' ? 500 : 100,
  })

  // Q1: Lead/OSINT chips follow thread routeFlag, not only crm-ops triggerReason.
  if (chip === 'lead' || chip === 'osint') {
    const routeFlag = chip === 'lead' ? 'crm_email_lead' : 'spam_osint_queue'
    const threads = await EmailThreadService.listThreads({ routeFlag, limit: 500 })
    const ids = new Set(threads.map((t) => t.id))
    tasks = tasks.filter((t) => ids.has(t.threadId)).slice(0, 100)
  }

  return NextResponse.json({ tasks })
}

/**
 * Handles POST requests to create a new email task.
 * - Establishes DB connection.
 * - Checks admin permissions.
 * - Validates required fields in request body.
 * - Creates and returns the new task.
 */
export async function POST(req: NextRequest) {
  await connection() // ensure database connection is established
  const authResult = await requireEmailAdmin() // check if the user is an email admin

  // If user is not authorized, return an appropriate error and status
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json() // parse request body as JSON

  // Validate presence of required fields in request body
  if (!body?.threadId || !body?.title || !body?.taskType) {
    return NextResponse.json({ error: 'threadId, title, taskType required' }, { status: 400 })
  }

  // Create a new task with the provided body data
  const task = await getEmailTaskService().createTask(body)

  // TODO: With React 19 and Next.js 16, consider zod or typescript schema validation at the edge for safer parsing.

  return NextResponse.json({ task }) // return the created task as JSON response
}
