import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { VideoConductor } from '@/lib/video/conductor/video-conductor'
import type { GenerateVideoContext, VideoQualityMode } from '@/lib/video/conductor/types'

type GenerateVideoBody = Partial<GenerateVideoContext> & {
  prompt?: string
  remaster?: boolean
  persistToFilebase?: boolean
}

export const POST = withMcpGuard(async (request, actor) => {
  const body = await readJsonBody<GenerateVideoBody>(request)
  if (!body?.prompt?.trim()) {
    return mcpError('prompt is required', 400)
  }

  const ctx: GenerateVideoContext = {
    prompt: body.prompt.trim(),
    qualityMode: body.qualityMode as VideoQualityMode | undefined,
    model: body.model,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    imageUrl: body.imageUrl,
    purpose: body.purpose,
    refCode: body.refCode,
    remasterFromRequestId: body.remasterFromRequestId,
    persistToFilebase: body.persistToFilebase,
    actorId: actor.id,
  }

  const result = body.remaster
    ? await VideoConductor.remaster(ctx)
    : await VideoConductor.generate(ctx)

  if (!result.success) {
    return mcpError(result.error || 'Video generation failed', 502)
  }

  return mcpOk(result, 201)
})
