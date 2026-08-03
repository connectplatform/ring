import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  listTaskTreeForUser,
  type TaskTreeFilter,
} from '@/features/tasks/services/task-query-service'

const FILTERS = new Set<TaskTreeFilter>(['all', 'available', 'in_progress', 'completed'])

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const filterParam = (url.searchParams.get('filter') || 'all') as TaskTreeFilter
    const filter = FILTERS.has(filterParam) ? filterParam : 'all'

    const tree = await listTaskTreeForUser(session.user.id, filter)

    return NextResponse.json(tree)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tasks'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
