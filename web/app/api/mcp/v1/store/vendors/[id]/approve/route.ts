import { VendorOnboardingStatus } from '@/constants/store'
import { updateOnboardingStatus } from '@/features/store/services/vendor-lifecycle'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// The context type contains possibly asynchronous params, expected to provide vendor id
type Ctx = { params: Promise<{ id: string }> }

// Wrap the POST handler in the MCP authorization guard utility
// TODO: If Next.js 16 (Next 16) implements native middleware guards, migrate away from custom HOC (withMcpGuard).
export const POST = withMcpGuard(
  // Main POST handler for approving a vendor onboarding
  async (request, _actor, context?: Ctx) => {
    // Extract the vendor id from context params, fallback to empty string
    // TODO: Once Next.js route handlers ensure context params are always available, remove fallback
    const { id } = await (context?.params || Promise.resolve({ id: '' }))

    // Read the request body as JSON (expects .notes field optionally)
    const body = await readJsonBody(request)
    // Update the onboarding status to APPROVED, optionally including notes.
    // Notes are expected to be a string, or undefined if not provided
    await updateOnboardingStatus(id, VendorOnboardingStatus.APPROVED, body?.notes as string | undefined)
    
    // Respond with a success indicator and the vendor id
    return mcpOk({ approved: true, id })
  }
)
