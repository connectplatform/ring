import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import type { GenerateImageContext, ImageProviderId } from '@/lib/images/conductor/types'

// Define expected request body. Accepts partial GenerateImageContext and prompt string.
type GenerateImageBody = Partial<GenerateImageContext> & {
  prompt?: string
}

// POST handler for image generation endpoint.
// Applies MCP guard for authentication/authorization.
// TODO: When Next.js 16 stable supports middleware chaining, migrate guard to middleware directory.

export const POST = withMcpGuard(async (request, actor) => {
  // Attempt to parse and validate incoming JSON body.
  // Returns 400 if body missing or prompt is blank/empty.
  const body = await readJsonBody<GenerateImageBody>(request)
  if (!body?.prompt?.trim()) {
    // Error handling for missing prompt.
    return mcpError('prompt is required', 400)
  }

  // Invoke image generation process with parameters.
  // Trims prompt, casts provider to ImageProviderId if specified.
  // actorId comes from authenticated session/user via guard.
  // TODO: Consider schema validation (e.g., zod) for input once Next.js 16 API route upgrades are complete.
  // TODO: Consider edge runtime for performant API once Next.js 16 GA.

  const result = await ImageConductor.generate({
    prompt: body.prompt.trim(),
    provider: body.provider as ImageProviderId | undefined,
    model: body.model,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    n: body.n,
    seed: body.seed,
    purpose: body.purpose,
    refCode: body.refCode,
    actorId: actor.id,
  })

  // If image generation fails, respond with error and suggested HTTP code.
  // TODO: Add error logging or tracing here in Next.js 16 instrumentation event hooks.
  if (!result.success) {
    return mcpError(result.error || 'Image generation failed', 502)
  }

  // On success, return result with 201 (Created).
  return mcpOk(result, 201)
})
