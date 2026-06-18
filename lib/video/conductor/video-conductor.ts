import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import { db } from '@/lib/database'
import {
  estimateVideoCostUsd,
  getPollIntervalMs,
  getPollTimeoutMs,
  getStoragePrefix,
  getXaiVideoConfig,
  resolveQualityMode,
} from '@/lib/video/video.config'
import { pollXaiVideo, startXaiVideoGeneration } from '@/lib/video/providers/xai.provider'
import type {
  GenerateVideoContext,
  GenerateVideoResult,
  GeneratedVideoRecord,
} from '@/lib/video/conductor/types'

function buildObjectKey(purpose: string | undefined, qualityMode: string): string {
  const prefix = getStoragePrefix()
  const category = purpose?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'video'
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${category}/${qualityMode}/${stamp}-${suffix}.mp4`
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
  },
): Promise<{ url: string; fileId?: string; size: number; recordId?: string }> {
  const response = await fetch(temporaryUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated video (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const objectKey = buildObjectKey(ctx.purpose, meta.qualityMode)
  const upload = await file().upload(objectKey, buffer, {
    access: 'public',
    contentType: 'video/mp4',
    metadata: {
      source: 'xai',
      model: meta.model,
      qualityMode: meta.qualityMode,
      requestId: meta.requestId,
      ...(ctx.purpose ? { purpose: ctx.purpose } : {}),
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

export const VideoConductor = {
  async generate(ctx: GenerateVideoContext): Promise<GenerateVideoResult> {
    if (!ctx.prompt?.trim()) {
      return { success: false, error: 'prompt is required' }
    }

    const qualityMode = resolveQualityMode(ctx.qualityMode)
    const config = getXaiVideoConfig({ ...ctx, qualityMode })

    try {
      const requestId = await startXaiVideoGeneration({
        prompt: ctx.prompt.trim(),
        qualityMode,
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
        return { success: false, error: 'xAI returned no video URL', requestId }
      }

      if (polled.video?.respect_moderation === false) {
        return {
          success: false,
          error: 'Video filtered by moderation',
          requestId,
          qualityMode,
        }
      }

      const duration = polled.video?.duration ?? config.duration
      const estimatedCostUsd = estimateVideoCostUsd(duration, config.estimatedUsdPerSecond)

      let videoUrl = temporaryUrl
      let fileId: string | undefined
      let size: number | undefined
      let recordId: string | undefined

      if (ctx.persistToFilebase !== false) {
        const persisted = await persistVideoFromUrl(ctx, temporaryUrl, {
          requestId,
          model: polled.model || config.model,
          qualityMode,
          resolution: config.resolution,
          duration,
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
        qualityMode,
        resolution: config.resolution,
        prompt: ctx.prompt.trim(),
        requestId,
        estimatedCostUsd,
        remasterFromRequestId: ctx.remasterFromRequestId,
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
      return { success: false, error: message, prompt: ctx.prompt, qualityMode }
    }
  },

  /** Regenerate at production (720p) using same prompt; links to draft request_id */
  async remaster(ctx: GenerateVideoContext): Promise<GenerateVideoResult> {
    return VideoConductor.generate({
      ...ctx,
      qualityMode: ctx.imageUrl ? 'production_i2v' : 'production',
      remasterFromRequestId: ctx.remasterFromRequestId,
      persistToFilebase: ctx.persistToFilebase,
    })
  },
}
