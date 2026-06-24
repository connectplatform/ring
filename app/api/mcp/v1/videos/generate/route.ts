import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { generateVideoBodySchema } from '@/lib/media/schemas'
import { VideoConductor } from '@/lib/video/conductor/video-conductor'
import type { GenerateVideoContext } from '@/lib/video/conductor/types'

export const POST = withMcpGuard(async (request, actor) => {
  const raw = await readJsonBody<unknown>(request)
  const parsed = generateVideoBodySchema.safeParse(raw)

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ')
    return mcpError(message || 'Invalid request body', 400)
  }

  const body = parsed.data
  const sourceVideoUrl = body.sourceVideoUrl?.trim() || body.remasterFromVideoUrl?.trim()

  const ctx: GenerateVideoContext = {
    prompt: body.prompt.trim(),
    qualityMode: body.qualityMode,
    model: body.model,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    imageUrl: body.imageUrl,
    firstFramePrompt: body.firstFramePrompt,
    imageProvider: body.imageProvider,
    imageModel: body.imageModel,
    imageResolution: body.imageResolution,
    thumbnail: body.thumbnail,
    clipId: body.clipId,
    pipelineRequestId: body.pipelineRequestId,
    sourceVideoUrl,
    purpose: body.purpose,
    refCode: body.refCode,
    remasterFromRequestId: body.remasterFromRequestId,
    remasterFromVideoUrl: sourceVideoUrl,
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
