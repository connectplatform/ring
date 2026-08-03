import type { ImageProviderId } from '@/lib/images/conductor/types'
import { ModelRouterError, resolveKeyForModel, resolveModel } from '@/lib/ai/model-router'

const VALID_PROVIDERS: ImageProviderId[] = ['xai', 'google']

function normalizeProvider(raw?: string | null): ImageProviderId | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'xai' || value === 'google') return value
  return null
}

const DEFAULT_PROVIDER: ImageProviderId =
  normalizeProvider(process.env.IMAGE_GEN_PROVIDER) ?? 'xai'

export function getImageProvider(override?: string): ImageProviderId {
  const fromOverride = normalizeProvider(override)
  if (fromOverride) return fromOverride
  return DEFAULT_PROVIDER
}

export function getPollTimeoutMs(): number {
  const raw = Number.parseInt(process.env.IMAGE_GEN_POLL_TIMEOUT_MS ?? '120000', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000
}

export function getStoragePrefix(): string {
  const prefix = process.env.IMAGE_GEN_STORAGE_PREFIX?.trim()
  return prefix || 'generated'
}

export function getXaiConfig(ctx: {
  model?: string
  aspectRatio?: string
  resolution?: string
  n?: number
  /** When true, resolve via image_edit task class (reference edits). */
  edit?: boolean
}) {
  const taskClass = ctx.edit ? 'image_edit' : 'image_generate'
  let apiKey = ''
  let baseUrl = (process.env.XAI_API_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, '')
  let model =
    ctx.model?.trim() || process.env.XAI_IMAGE_MODEL?.trim() || 'grok-imagine-image-quality'

  try {
    if (ctx.model?.trim()) {
      const keyed = resolveKeyForModel('xai', ctx.model.trim())
      apiKey = keyed.apiKey
      baseUrl = keyed.baseUrl
      model = ctx.model.trim()
    } else {
      const resolved = resolveModel(taskClass)
      if (resolved.provider === 'xai') {
        apiKey = resolved.apiKey
        baseUrl = resolved.endpoint.baseUrl
        model = process.env.XAI_IMAGE_MODEL?.trim() || resolved.modelId
      } else {
        const keyed = resolveKeyForModel('xai', 'grok-imagine-image-quality')
        apiKey = keyed.apiKey
        baseUrl = keyed.baseUrl
        model = process.env.XAI_IMAGE_MODEL?.trim() || 'grok-imagine-image-quality'
      }
    }
  } catch (error) {
    if (error instanceof ModelRouterError) {
      throw new Error(
        `xAI image API key not configured. Tried: ${error.triedKeyEnvs.join(', ') || 'XAI_IMAGE_API_KEY, XAI_API_KEY'}`,
      )
    }
    throw error
  }

  return {
    apiKey,
    baseUrl,
    model,
    aspectRatio: ctx.aspectRatio?.trim() || process.env.XAI_IMAGE_ASPECT_RATIO?.trim() || '1:1',
    resolution: (ctx.resolution?.trim() || process.env.XAI_IMAGE_RESOLUTION?.trim() || '2k').toLowerCase(),
    n: clampCount(ctx.n, 1, 10, 1),
  }
}

export function getGoogleConfig(ctx: { model?: string; aspectRatio?: string; resolution?: string; n?: number }) {
  const imageSize = (ctx.resolution?.trim() || process.env.GOOGLE_IMAGE_SIZE?.trim() || '2K').toUpperCase()
  let apiKey = process.env.GOOGLE_GENAI_API_KEY?.trim() ?? ''
  let baseUrl = (
    process.env.GOOGLE_GENAI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/$/, '')
  try {
    const keyed = resolveKeyForModel('google', ctx.model?.trim() || 'imagen-4.0-generate-001')
    apiKey = keyed.apiKey
    baseUrl = keyed.baseUrl
  } catch {
    // leave empty — provider will throw clearly
  }
  return {
    apiKey,
    baseUrl,
    model: ctx.model?.trim() || process.env.GOOGLE_IMAGE_MODEL?.trim() || 'imagen-4.0-generate-001',
    aspectRatio: ctx.aspectRatio?.trim() || process.env.GOOGLE_IMAGE_ASPECT_RATIO?.trim() || '1:1',
    imageSize: imageSize === '1K' || imageSize === '2K' ? imageSize : '2K',
    n: clampCount(ctx.n, 1, 4, 1),
  }
}

function clampCount(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}
