import type { ImageProviderId } from '@/lib/images/conductor/types'

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

export function getXaiConfig(ctx: { model?: string; aspectRatio?: string; resolution?: string; n?: number }) {
  return {
    apiKey: process.env.XAI_API_KEY?.trim() ?? '',
    baseUrl: (process.env.XAI_API_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, ''),
    model: ctx.model?.trim() || process.env.XAI_IMAGE_MODEL?.trim() || 'grok-imagine-image-quality',
    aspectRatio: ctx.aspectRatio?.trim() || process.env.XAI_IMAGE_ASPECT_RATIO?.trim() || '1:1',
    resolution: (ctx.resolution?.trim() || process.env.XAI_IMAGE_RESOLUTION?.trim() || '2k').toLowerCase(),
    n: clampCount(ctx.n, 1, 10, 1),
  }
}

export function getGoogleConfig(ctx: { model?: string; aspectRatio?: string; resolution?: string; n?: number }) {
  const imageSize = (ctx.resolution?.trim() || process.env.GOOGLE_IMAGE_SIZE?.trim() || '2K').toUpperCase()
  return {
    apiKey: process.env.GOOGLE_GENAI_API_KEY?.trim() ?? '',
    baseUrl: (process.env.GOOGLE_GENAI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
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
