import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'

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

  // Extract 'status' filter from URL query parameters
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  // Query for tasks, optionally filtered by status, with a max of 100 results
  const tasks = await getEmailTaskService().searchTasks({
    status: status ? (status as never) : undefined,
    limit: 100,
  })

  // TODO: Consider using Next.js 16 caching/revalidation features if tasks don't always need to be fresh.

  return NextResponse.json({ tasks }) // return tasks as JSON response
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
