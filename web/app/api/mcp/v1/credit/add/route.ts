import { CreditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { z } from 'zod'

function resolveMainCurrencyRate(body: Record<string, unknown>): string {
  const parsed = z
    .object({
      mainCurrencyRate: z.string().optional(),
      usdRate: z.string().optional(),
    })
    .safeParse(body)
  if (!parsed.success) return '1'
  return String(parsed.data.mainCurrencyRate ?? parsed.data.usdRate ?? '1')
}

// TODO: Move towards using Next.js 16 native request/response helpers (e.g., standardized parsing, validation).
// TODO: Add schema validation using Zod for request body (see implementation comment below).
// TODO: Consider using Next.js Middleware for pre-validation or authentication in future.

export const POST = withMcpGuard(async (request) => {
  // Attempt to read and decode JSON body from the request
  // TODO: Replace with native Next.js 16 request.json() when stable for unified API experience
  const body = await readJsonBody(request)

  // Sanity check: Require "confirm" to be explicitly true.
  // Protects accidental or malicious credit add attempts.
  if (body?.confirm !== true) {
    return mcpError('credit add requires confirm: true', 400)
  }

  // Data validation: Require both userId and amount fields to be present and not falsy
  if (!body?.userId || !body?.amount) {
    return mcpError('userId and amount are required', 400)
  }

  // TODO: Consider replacing manual checks above with Zod validation for type safety and better error messages:
  /*
    import { z } from "zod";
    const CreditAddSchema = z.object({
      userId: z.string().min(1),
      amount: z.string().min(1),
      confirm: z.boolean().refine(val => val === true, {
        message: 'credit add requires confirm: true'
      }),
      description: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      type: z.string().optional(),
      mainCurrencyRate: z.string().optional(),
      usdRate: z.string().optional(),
    });
    // const parsed = CreditAddSchema.safeParse(await request.json());
    // if (!parsed.success) return mcpError(parsed.error.message, 400);
  */

  // Service Layer: Safely get singleton instance of CreditBalanceService for performing the credit add
  // NOTE: If switching to server actions or new Next.js paradigms, ensure singleton is server safe
  const service = CreditBalanceService.getInstance()

  // Add credits, coercing key values to strings to meet downstream contract
  // NOTE: Defaults and coerctions are preserved; revisit if adopting schema validation
  const result = await service.addCredits(
    String(body.userId),                        // User ID as string for downstream contract
    {
      amount: String(body.amount),              // Amount as string
      description: String(body.description || 'ring-mcp credit add'), // Default if missing
      metadata: body.metadata as Record<string, unknown> | undefined, // Metadata is optional
    },
    (body.type as any) || 'bonus',              // Default type to 'bonus' if not given
    resolveMainCurrencyRate(body as Record<string, unknown>)
  )

  // Return unified "OK" response including all result data from addCredits workflow
  return mcpOk(result)
})
