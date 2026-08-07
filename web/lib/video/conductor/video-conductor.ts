import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import { db } from '@/lib/database'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import { renderAndUploadThumbnail } from '@/lib/media/thumbnail'
import {
  estimateVideoCostUsd,
  getPollIntervalMs,
  getPollTimeoutMs,
  getRemasterEditModel,
  getStoragePrefix,
  getVideoPreset,
  getXaiVideoConfig,
  resolveEffectiveQualityMode,
} from '@/lib/video/video.config'
import { pollXaiVideo, startXaiVideoEdit, startXaiVideoGeneration } from '@/lib/video/providers/xai.provider'
import type {
  GenerateVideoContext,
  GenerateVideoResult,
  GeneratedVideoRecord,
  GeneratedVideoResultAsset,
  VideoQualityMode,
} from '@/lib/video/conductor/types'

function buildObjectKey(purpose: string | undefined, qualityMode: string, kind: string): string {
  const prefix = getStoragePrefix()
  const category = purpose?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'video'
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${category}/${qualityMode}/${kind}/${stamp}-${suffix}.mp4`
}

async function persistVideoFromUrl(
  ctx: GenerateVideoContext,
  temporaryUrl: string,
  meta: {
    requestId: string
    model: string
    qualityMode: string
    resolution: string
    duration?: number
    generationKind?: string
    firstFrameUrl?: string
    thumbnailUrl?: string
  },
): Promise<{ url: string; fileId?: string; size: number; recordId?: string }> {
  const response = await fetch(temporaryUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated video (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const objectKey = buildObjectKey(ctx.purpose, meta.qualityMode, meta.generationKind || 'generate')
  const upload = await file().upload(objectKey, buffer, {
    access: 'public',
    contentType: 'video/mp4',
    metadata: {
      source: 'xai',
      model: meta.model,
      qualityMode: meta.qualityMode,
      requestId: meta.requestId,
      generationKind: meta.generationKind || 'generate',
      ...(ctx.purpose ? { purpose: ctx.purpose } : {}),
      ...(ctx.clipId ? { clipId: ctx.clipId } : {}),
    },
  })

  if (!upload.success || !upload.url) {
    throw new Error(upload.error || 'Failed to upload generated video to ring-filebase')
  }

  const recordId = randomUUID()
  const createdAt = new Date().toISOString()
  const record: GeneratedVideoRecord = {
    actorId: ctx.actorId,
    provider: 'xai',
    model: meta.model,
    qualityMode: meta.qualityMode as GeneratedVideoRecord['qualityMode'],
    resolution: meta.resolution,
    prompt: ctx.prompt,
    requestId: meta.requestId,
    remasterFromRequestId: ctx.remasterFromRequestId,
    remasterFromVideoUrl: ctx.remasterFromVideoUrl || ctx.sourceVideoUrl,
    generationKind: meta.generationKind as GeneratedVideoRecord['generationKind'],
    firstFrameUrl: meta.firstFrameUrl,
    thumbnailUrl: meta.thumbnailUrl,
    clipId: ctx.clipId,
    pipelineRequestId: ctx.pipelineRequestId,
    purpose: ctx.purpose,
    refCode: ctx.refCode,
    url: upload.url,
    fileId: upload.fileId,
    size: upload.size ?? buffer.length,
    duration: meta.duration,
    createdAt,
  }

  try {
    const created = await db().createDoc('generated_videos', record, { id: recordId })
    if (!created.success) {
      console.warn('VideoConductor: generated_videos persist skipped', created.error?.message)
    }
  } catch {
    // Collection may not exist yet — upload URL is still valid
  }

  return {
    url: upload.url,
    fileId: upload.fileId,
    size: upload.size ?? buffer.length,
    recordId,
  }
}

async function ensureFirstFrame(
  ctx: GenerateVideoContext,
): Promise<{ ctx: GenerateVideoContext; firstFrame?: GeneratedVideoResultAsset }> {
  if (ctx.imageUrl?.trim()) {
    return { ctx }
  }

  if (!ctx.firstFramePrompt?.trim()) {
    return { ctx }
  }

  const imageResult = await ImageConductor.generate({
    prompt: ctx.firstFramePrompt.trim(),
    provider: ctx.imageProvider,
    model: ctx.imageModel,
    aspectRatio: ctx.aspectRatio || '16:9',
    resolution: ctx.imageResolution || '2k',
    purpose: ctx.purpose,
    refCode: ctx.refCode,
    actorId: ctx.actorId,
  })

  if (!imageResult.success || !imageResult.images?.[0]?.url) {
    throw new Error(imageResult.error || 'First frame image generation failed')
  }

  const image = imageResult.images[0]
  return {
    ctx: { ...ctx, imageUrl: image.url },
    firstFrame: {
      url: image.url,
      recordId: image.recordId,
      fileId: image.fileId,
      size: image.size,
      contentType: image.contentType,
    },
  }
}

async function runVideoJob(
  ctx: GenerateVideoContext,
  options: {
    qualityMode: VideoQualityMode
    generationKind: 'generate' | 'edit'
    remasterFromVideoUrl?: string
    firstFrame?: GeneratedVideoResultAsset
    thumbnail?: GeneratedVideoResultAsset
  },
): Promise<GenerateVideoResult> {
  const config = getXaiVideoConfig({ ...ctx, qualityMode: options.qualityMode })

  try {
    const requestId =
      options.generationKind === 'edit'
        ? await startXaiVideoEdit({
            prompt: ctx.prompt.trim(),
            sourceVideoUrl: ctx.sourceVideoUrl!.trim(),
            model: ctx.model || getRemasterEditModel(),
          })
        : await startXaiVideoGeneration({
            prompt: ctx.prompt.trim(),
            qualityMode: options.qualityMode,
            model: ctx.model,
            duration: ctx.duration,
            aspectRatio: ctx.aspectRatio,
            resolution: ctx.resolution,
            imageUrl: ctx.imageUrl,
          })

    const polled = await pollXaiVideo(requestId, {
      timeoutMs: getPollTimeoutMs(),
      intervalMs: getPollIntervalMs(),
    })

    const temporaryUrl = polled.video?.url
    if (!temporaryUrl) {
      return { success: false, error: 'xAI returned no video URL', requestId, qualityMode: options.qualityMode }
    }

    if (polled.video?.respect_moderation === false) {
      return {
        success: false,
        error: 'Video filtered by moderation',
        requestId,
        qualityMode: options.qualityMode,
      }
    }

    const duration = polled.video?.duration ?? config.duration
    const estimatedCostUsd =
      options.generationKind === 'edit'
        ? estimateVideoCostUsd(duration, getVideoPresetRate('production'))
        : estimateVideoCostUsd(duration, config.estimatedUsdPerSecond)

    let videoUrl = temporaryUrl
    let fileId: string | undefined
    let size: number | undefined
    let recordId: string | undefined

    if (ctx.persistToFilebase !== false) {
      const persisted = await persistVideoFromUrl(ctx, temporaryUrl, {
        requestId,
        model: polled.model || config.model,
        qualityMode: options.qualityMode,
        resolution: options.generationKind === 'edit' ? 'source' : config.resolution,
        duration,
        generationKind: options.generationKind,
        firstFrameUrl: options.firstFrame?.url,
        thumbnailUrl: options.thumbnail?.url,
      })
      videoUrl = persisted.url
      fileId = persisted.fileId
      size = persisted.size
      recordId = persisted.recordId
    }

    return {
      success: true,
      provider: 'xai',
      model: polled.model || config.model,
      qualityMode: options.qualityMode,
      resolution: options.generationKind === 'edit' ? undefined : config.resolution,
      prompt: ctx.prompt.trim(),
      requestId,
      estimatedCostUsd,
      clipId: ctx.clipId,
      pipelineRequestId: ctx.pipelineRequestId,
      remasterFromRequestId: ctx.remasterFromRequestId,
      remasterFromVideoUrl: options.remasterFromVideoUrl || ctx.sourceVideoUrl,
      generationKind: options.generationKind,
      firstFrame: options.firstFrame,
      thumbnail: options.thumbnail,
      video: {
        url: videoUrl,
        temporaryUrl,
        fileId,
        size,
        contentType: 'video/mp4',
        recordId,
        requestId,
        duration,
        respectModeration: polled.video?.respect_moderation,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, prompt: ctx.prompt, qualityMode: options.qualityMode }
  }
}

function getVideoPresetRate(mode: VideoQualityMode): number {
  try {
    return getVideoPreset(mode).estimatedUsdPerSecond
  } catch {
    return 0.05
  }
}

async function maybeRenderThumbnail(
  ctx: GenerateVideoContext,
  firstFrame?: GeneratedVideoResultAsset,
): Promise<GeneratedVideoResultAsset | undefined> {
  if (!ctx.thumbnail?.enabled) {
    return undefined
  }

  const backgroundUrl = firstFrame?.url || ctx.imageUrl?.trim()
  if (!backgroundUrl) {
    throw new Error('Thumbnail requires a first-frame image URL')
  }

  const rendered = await renderAndUploadThumbnail({
    backgroundUrl,
    thumbnail: ctx.thumbnail,
    purpose: ctx.purpose,
  })

  return {
    url: rendered.url,
    recordId: rendered.recordId,
    fileId: rendered.fileId,
    size: rendered.size,
    contentType: rendered.contentType,
  }
}

export const VideoConductor = {
  async generate(ctx: GenerateVideoContext): Promise<GenerateVideoResult> {
    if (!ctx.prompt?.trim()) {
      return { success: false, error: 'prompt is required' }
    }

    try {
      const { ctx: withFrame, firstFrame } = await ensureFirstFrame(ctx)

      const qualityMode = resolveEffectiveQualityMode({
        qualityMode: withFrame.qualityMode,
        imageUrl: withFrame.imageUrl,
      })

      const thumbnail = await maybeRenderThumbnail(withFrame, firstFrame)

      return runVideoJob(withFrame, {
        qualityMode,
        generationKind: 'generate',
        firstFrame,
        thumbnail,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message, prompt: ctx.prompt }
    }
  },

  /** Edit/remaster an existing MP4 URL (manifest CDN or xAI temporary URL) */
  async editFromSource(ctx: GenerateVideoContext): Promise<GenerateVideoResult> {
    if (!ctx.prompt?.trim()) {
      return { success: false, error: 'prompt is required' }
    }
    if (!ctx.sourceVideoUrl?.trim()) {
      return { success: false, error: 'sourceVideoUrl is required for edit/remaster' }
    }

    return runVideoJob(ctx, {
      qualityMode: 'production',
      generationKind: 'edit',
      remasterFromVideoUrl: ctx.sourceVideoUrl.trim(),
    })
  },

  /**
   * Remaster strategies:
   * - sourceVideoUrl set → POST /v1/videos/edits (scene-preserving prompt edit)
   * - imageUrl set → production_i2v re-generate at 720p
   * - else → production T2V re-generate at 720p with same prompt
   */
  async remaster(ctx: GenerateVideoContext): Promise<GenerateVideoResult> {
    if (ctx.sourceVideoUrl?.trim()) {
      return VideoConductor.editFromSource({
        ...ctx,
        remasterFromVideoUrl: ctx.remasterFromVideoUrl || ctx.sourceVideoUrl,
      })
    }

    try {
      const { ctx: withFrame, firstFrame } = await ensureFirstFrame(ctx)

      const qualityMode = resolveEffectiveQualityMode({
        qualityMode: withFrame.qualityMode,
        imageUrl: withFrame.imageUrl,
        remaster: true,
      })

      const thumbnail = await maybeRenderThumbnail(withFrame, firstFrame)

      return runVideoJob(withFrame, {
        qualityMode,
        generationKind: 'generate',
        firstFrame,
        thumbnail,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message, prompt: ctx.prompt }
    }
  },
}
