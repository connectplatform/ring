import { approveMainPagePublication } from '@/features/news/services/news-promotion-workflow'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

// Type alias defining the expected context shape, where params is a Promise resolving to an object containing 'id'
type Ctx = { params: Promise<{ id: string }> }

// Exported POST handler, protected by withMcpGuard authentication/authorization utility.
export const POST = withMcpGuard(async (_request, actor, context?: Ctx) => {
  // Await resolution of context params to extract 'id'.
  // If context/params is missing, fall back to a dummy id value ('').
  // TODO: Consider error handling for missing or malformed 'id' instead of defaulting to ''
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Call the service responsible for approving main page publication of the news item.
  // Both 'id' and the acting user's id are required.
  // TODO: Validate that 'id' is not empty and is a valid format before proceeding.
  await approveMainPagePublication(id, actor.id)

  // Send a standardized OK HTTP response with approval status and the id.
  return mcpOk({ approved: true, id })
})
