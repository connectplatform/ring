import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import { db } from '@/lib/database'
import { getImageProvider, getPollTimeoutMs, getStoragePrefix } from '@/lib/images/image.config'
import { generateGoogleImages } from '@/lib/images/providers/google.provider'
import { generateXaiImages } from '@/lib/images/providers/xai.provider'
import type {
  GenerateImageContext,
  GenerateImageResult,
  GeneratedImage,
  GeneratedImageRecord,
  ImageProviderId,
  ProviderImageOutput,
} from '@/lib/images/conductor/types'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Image generation timed out after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function generateFromProvider(
  provider: ImageProviderId,
  ctx: GenerateImageContext
): Promise<ProviderImageOutput[]> {
  if (provider === 'google') return generateGoogleImages(ctx)
  return generateXaiImages(ctx)
}

function buildObjectKey(purpose: string | undefined, index: number): string {
  const prefix = getStoragePrefix()
  const category = purpose?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'image'
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${category}/${stamp}-${index}-${suffix}.png`
}

async function persistGeneratedImage(
  ctx: GenerateImageContext,
  output: ProviderImageOutput,
  index: number
): Promise<GeneratedImage> {
  const objectKey = buildObjectKey(ctx.purpose, index)
  const upload = await file().upload(objectKey, output.buffer, {
    access: 'public',
    contentType: output.contentType,
    metadata: {
      source: output.provider,
      model: output.model,
      ...(ctx.purpose ? { purpose: ctx.purpose } : {}),
    },
  })

  if (!upload.success || !upload.url) {
    throw new Error(upload.error || 'Failed to upload generated image to ring-filebase')
  }

  const recordId = randomUUID()
  const createdAt = new Date().toISOString()
  const record: GeneratedImageRecord = {
    actorId: ctx.actorId,
    provider: output.provider,
    model: output.model,
    prompt: ctx.prompt,
    enhancedPrompt: output.enhancedPrompt,
    aspectRatio: ctx.aspectRatio,
    resolution: ctx.resolution,
    purpose: ctx.purpose,
    refCode: ctx.refCode,
    url: upload.url,
    fileId: upload.fileId,
    size: upload.size ?? output.buffer.length,
    createdAt,
  }

  const created = await db().createDoc('generated_images', record, { id: recordId })
  if (!created.success) {
    throw created.error || new Error('Failed to persist generated_images record')
  }

  return {
    url: upload.url,
    fileId: upload.fileId,
    size: upload.size ?? output.buffer.length,
    contentType: output.contentType,
    recordId,
  }
}

export const ImageConductor = {
  async generate(ctx: GenerateImageContext): Promise<GenerateImageResult> {
    if (!ctx.prompt?.trim()) {
      return { success: false, error: 'prompt is required' }
    }

    try {
      const provider = getImageProvider(ctx.provider)
      const outputs = await withTimeout(generateFromProvider(provider, ctx), getPollTimeoutMs())

      const images: GeneratedImage[] = []
      for (let index = 0; index < outputs.length; index += 1) {
        images.push(await persistGeneratedImage(ctx, outputs[index], index))
      }

      return {
        success: true,
        provider,
        model: outputs[0]?.model,
        prompt: ctx.prompt,
        images,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message, prompt: ctx.prompt }
    }
  },
}
