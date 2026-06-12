import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/services/email/crm/task-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json().catch(() => ({}))
  const { id } = await params
  const task = await getEmailTaskService().completeTask(id, {
    completedBy: authResult.session.user.id,
    completionNotes: body.completionNotes,
  })

  return NextResponse.json({ task })
}
