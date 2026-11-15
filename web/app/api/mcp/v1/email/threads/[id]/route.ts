import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import { isUnsubscribeUrlAllowlisted } from '@/features/email-crm/lib/unsubscribe-rfc8058'
import { getConfiguredUnsubscribeAllowHosts } from '@/features/email-crm/lib/unsubscribe-allow-hosts'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  if (!id) return mcpError('id is required', 400)

  const thread = await EmailThreadService.getThread(id)
  if (!thread) return mcpError('Thread not found', 404)

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

  return mcpOk({
    thread: { ...thread, unsubscribeOneClickEligible },
    messages,
    drafts,
    tasks,
  })
})
