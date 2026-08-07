import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  listTasksForConversation,
  type TaskTreeFilter,
} from '@/features/tasks/services/task-query-service'

const FILTERS = new Set<TaskTreeFilter>(['all', 'available', 'in_progress', 'completed'])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const conversationId = String(id || '').trim()
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 })
    }

    const url = new URL(request.url)
    const filterParam = (url.searchParams.get('filter') || 'all') as TaskTreeFilter
    const filter = FILTERS.has(filterParam) ? filterParam : 'all'

    const tasks = await listTasksForConversation(session.user.id, conversationId, filter)

    return NextResponse.json({ conversationId, tasks })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load conversation tasks'
    const status = message === 'Conversation not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
