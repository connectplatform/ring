import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/services/email/crm/task-service'

// API handler for marking an email task as complete
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Establish database connection
  await connection()

  // Ensure that the user is an authenticated email admin
  const authResult = await requireEmailAdmin()

  // If authentication fails, return an error response
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  // Parse the request body; default to empty object if parsing fails
  const body = await req.json().catch(() => ({}))

  // TODO: Next.js 13+ route handlers can use zod/superstruct/yup/etc. for body validation
  // TODO: Consider using `unstable_parseBody` for type-safe body parsing in Next.js 16+

  // Extract the task ID from route params (note: params is a promise)
  const { id } = await params

  // Attempt to mark the specified email task as complete
  const task = await getEmailTaskService().completeTask(id, {
    completedBy: authResult.session.user.id,   // The currently logged in admin user
    completionNotes: body.completionNotes,      // Optional notes provided by the user
  })

  // Return the updated task in the API response
  return NextResponse.json({ task })
}
