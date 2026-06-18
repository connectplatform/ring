import presets from '@/lib/video/video-presets.json'
import type { VideoQualityMode } from '@/lib/video/conductor/types'

export type VideoPreset = {
  model: string
  resolution: string
  estimatedUsdPerSecond: number
  supportsTextToVideo?: boolean
  requiresImageUrl?: boolean
}

export function getVideoDefaults() {
  return presets.defaults
}

export function getVideoPreset(mode: VideoQualityMode): VideoPreset {
  const preset = presets.modes[mode]
  if (!preset) {
    throw new Error(`Unknown video quality mode: ${mode}`)
  }
  return preset as VideoPreset
}

export function resolveQualityMode(raw?: string): VideoQualityMode {
  const value = String(raw ?? presets.defaults.qualityMode).trim().toLowerCase()
  if (value === 'production' || value === 'prod' || value === '720p') return 'production'
  if (value === 'production_i2v' || value === 'i2v') return 'production_i2v'
  return 'draft'
}

export function getPollTimeoutMs(): number {
  const raw = Number.parseInt(process.env.VIDEO_GEN_POLL_TIMEOUT_MS ?? String(presets.defaults.pollTimeoutMs), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : presets.defaults.pollTimeoutMs
}

export function getPollIntervalMs(): number {
  const raw = Number.parseInt(process.env.VIDEO_GEN_POLL_INTERVAL_MS ?? String(presets.defaults.pollIntervalMs), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : presets.defaults.pollIntervalMs
}

export function getStoragePrefix(): string {
  const prefix = process.env.VIDEO_GEN_STORAGE_PREFIX?.trim()
  return prefix || 'generated/videos'
}

export function getXaiVideoConfig(ctx: {
  qualityMode?: VideoQualityMode
  model?: string
  aspectRatio?: string
  resolution?: string
  duration?: number
}) {
  const mode = ctx.qualityMode ?? resolveQualityMode()
  const preset = getVideoPreset(mode)
  const apiKey = process.env.XAI_API_KEY?.trim() ?? ''
  const baseUrl = (process.env.XAI_API_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, '')

  const duration = clampDuration(
    ctx.duration ?? Number.parseInt(process.env.XAI_VIDEO_DEFAULT_DURATION ?? String(presets.defaults.duration), 10),
  )

  return {
    apiKey,
    baseUrl,
    qualityMode: mode,
    model: ctx.model?.trim() || process.env.XAI_VIDEO_MODEL?.trim() || preset.model,
    resolution: (ctx.resolution?.trim() || preset.resolution).toLowerCase(),
    aspectRatio: ctx.aspectRatio?.trim() || process.env.XAI_VIDEO_ASPECT_RATIO?.trim() || presets.defaults.aspectRatio,
    duration,
    estimatedUsdPerSecond: preset.estimatedUsdPerSecond,
    requiresImageUrl: Boolean(preset.requiresImageUrl),
    supportsTextToVideo: preset.supportsTextToVideo !== false,
  }
}

export function estimateVideoCostUsd(durationSeconds: number, estimatedUsdPerSecond: number): number {
  return Math.round(durationSeconds * estimatedUsdPerSecond * 100) / 100
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return presets.defaults.duration
  return Math.min(15, Math.max(1, Math.floor(value)))
}
