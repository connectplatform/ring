import type { TextProviderId } from '@/lib/text/conductor/types'

const VALID_PROVIDERS: TextProviderId[] = ['xai']

function normalizeProvider(raw?: string | null): TextProviderId | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'xai') return value
  return null
}

const DEFAULT_PROVIDER: TextProviderId =
  normalizeProvider(process.env.TEXT_GEN_PROVIDER) ?? 'xai'

export function getTextProvider(override?: string): TextProviderId {
  const fromOverride = normalizeProvider(override)
  if (fromOverride) return fromOverride
  return DEFAULT_PROVIDER
}

export function getTextPollTimeoutMs(): number {
  const raw = Number.parseInt(process.env.TEXT_GEN_POLL_TIMEOUT_MS ?? '180000', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 180_000
}

export function isXaiWebSearchEnabled(): boolean {
  return process.env.XAI_TEXT_WEBSEARCH !== 'false'
}

export function getXaiTextConfig(ctx: { model?: string; maxTokens?: number }) {
  return {
    apiKey: process.env.XAI_API_KEY?.trim() ?? '',
    baseUrl: (process.env.XAI_API_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, ''),
    model: ctx.model?.trim() || process.env.XAI_TEXT_MODEL?.trim() || 'grok-4.3',
    maxTokens: clampInt(ctx.maxTokens, 256, 32_000, Number.parseInt(process.env.XAI_TEXT_MAX_TOKENS ?? '8000', 10)),
    webSearch: isXaiWebSearchEnabled(),
    xSearch: process.env.XAI_TEXT_XSEARCH !== 'false',
  }
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return Math.min(max, Math.max(min, fallback))
  return Math.min(max, Math.max(min, Math.floor(value)))
}
