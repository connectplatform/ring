import { VendorOnboardingStatus } from '@/constants/store'
import { updateOnboardingStatus } from '@/features/store/services/vendor-lifecycle'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  await updateOnboardingStatus(id, VendorOnboardingStatus.APPROVED, body?.notes as string | undefined)
  return mcpOk({ approved: true, id })
})
