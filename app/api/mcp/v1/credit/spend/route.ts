import { CreditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
// TODO: Codemod - prefer Next.js 16 native middleware and built-in request validation
// TODO: If available, use Next.js 16 request schema validation via next/headers and e.g. zod

// POST handler to process credit spend requests, protected by withMcpGuard (guards have custom error handling)
export const POST = withMcpGuard(async (request) => {
  // Parse the JSON body from the request
  const body = await readJsonBody(request)
  // TODO: Validate and parse body with zod or similar for runtime safety & type inference - see example below

  // Immediately check that credit spend is explicitly confirmed by the client
  if (body?.confirm !== true) {
    // Return error if confirmation flag is not present or not true
    return mcpError('credit spend requires confirm: true', 400)
  }

  // Check that both userId and amount properties exist (minimum viable payload)
  if (!body?.userId || !body?.amount) {
    // Return error for missing required parameters
    return mcpError('userId and amount are required', 400)
  }

  // Use the singleton CreditBalanceService for write actions on credits
  const service = CreditBalanceService.getInstance()

  // STUB: DOWNSTREAM - Implement full error handling in spendCredits (e.g., insufficient funds, invalid user)
  // Attempt to spend credits for the user, using defensive coercion to string for API contract stability
  const result = await service.spendCredits(
    String(body.userId), // Ensure user IDs are always strings internally
    {
      amount: String(body.amount), // Coerce amount to string for compatibility
      description: String(body.description || 'ring-mcp credit spend'), // Fallback if no description
      metadata: body.metadata as Record<string, unknown> | undefined, // Pass through metadata if present
    },
    (body.type as any) || 'purchase', // Default to "purchase" if no type provided (TODO: codemod: define supported types with Zod enum)
    String(body.usdRate || '1') // Default exchange rate is "1" if not set
  )

  // TODO: Use Next.js 16 native request parsing & validation middleware—e.g.:
  // import { z } from 'zod';
  // const CreditSpendSchema = z.object({ userId: z.string(), amount: z.string(), confirm: z.literal(true), ... });
  // const body = await request.json();
  // const parsed = CreditSpendSchema.safeParse(body);

  // Successful spend, return result using custom responder
  return mcpOk(result)
})
