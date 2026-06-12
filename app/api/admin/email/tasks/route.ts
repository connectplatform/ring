import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/services/email/crm/task-service'

export async function GET(req: NextRequest) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const tasks = await getEmailTaskService().searchTasks({
    status: status ? (status as never) : undefined,
    limit: 100,
  })

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json()
  if (!body?.threadId || !body?.title || !body?.taskType) {
    return NextResponse.json({ error: 'threadId, title, taskType required' }, { status: 400 })
  }

  const task = await getEmailTaskService().createTask(body)
  return NextResponse.json({ task })
}
