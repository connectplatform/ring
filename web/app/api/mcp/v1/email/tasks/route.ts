import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import type { TaskStatus, TaskType } from '@/features/email-crm/types/task'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

const TASK_STATUSES = new Set<TaskStatus>(['open', 'in_progress', 'completed', 'cancelled', 'overdue'])
const TASK_TYPES = new Set<TaskType>([
  'follow_up',
  'escalation',
  'action_required',
  'review',
  'unsubscribe_pending',
])

function queryLimit(request: Parameters<typeof queryInt>[0], fallback = 100, max = 200): number {
  const value = queryInt(request, 'limit', fallback) ?? fallback
  if (value < 1) return fallback
  return Math.min(value, max)
}

export const GET = withMcpGuard(async (request) => {
  const statusRaw = queryString(request, 'status')
  const status =
    statusRaw && TASK_STATUSES.has(statusRaw as TaskStatus)
      ? (statusRaw as TaskStatus)
      : undefined

  const taskTypeRaw = queryString(request, 'taskType')
  const taskType =
    taskTypeRaw && TASK_TYPES.has(taskTypeRaw as TaskType)
      ? (taskTypeRaw as TaskType)
      : undefined

  const sourceChannel = queryString(request, 'sourceChannel')
  const limit = queryLimit(request)

  let items = await getEmailTaskService().searchTasks({
    status,
    taskType,
    limit: sourceChannel ? 500 : limit,
  })

  // Optional channel filter is applied through the parent thread.
  if (sourceChannel) {
    const threads = await EmailThreadService.listThreads({ sourceChannel, limit: 500 })
    const ids = new Set(threads.map((thread) => thread.id))
    items = items.filter((task) => ids.has(task.threadId)).slice(0, limit)
  }

  return mcpOk({ items, total: items.length })
})
