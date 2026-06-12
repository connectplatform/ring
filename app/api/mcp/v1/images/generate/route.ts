import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import type { GenerateImageContext, ImageProviderId } from '@/lib/images/conductor/types'

type GenerateImageBody = Partial<GenerateImageContext> & {
  prompt?: string
}

export const POST = withMcpGuard(async (request, actor) => {
  const body = await readJsonBody<GenerateImageBody>(request)
  if (!body?.prompt?.trim()) {
    return mcpError('prompt is required', 400)
  }

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

  if (!result.success) {
    return mcpError(result.error || 'Image generation failed', 502)
  }

  return mcpOk(result, 201)
})
