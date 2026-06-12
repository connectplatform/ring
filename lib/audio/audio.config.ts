import type { AudioProviderId } from '@/lib/audio/conductor/types'

function normalizeProvider(raw?: string | null): AudioProviderId | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'xai') return value
  return null
}

const DEFAULT_PROVIDER: AudioProviderId =
  normalizeProvider(process.env.TTS_PROVIDER) ?? 'xai'

export function getAudioProvider(override?: string): AudioProviderId {
  const fromOverride = normalizeProvider(override)
  if (fromOverride) return fromOverride
  return DEFAULT_PROVIDER
}

export function isTtsEnabled(): boolean {
  return process.env.XAI_TTS_ENABLED !== 'false'
}

export function getAudioStoragePrefix(): string {
  return (process.env.AUDIO_STORAGE_PREFIX?.trim() || 'generated/audio').replace(/\/$/, '')
}

export function getXaiTtsConfig(ctx: { voiceId?: string; language?: string }) {
  return {
    apiKey: process.env.XAI_API_KEY?.trim() ?? '',
    baseUrl: (process.env.XAI_API_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, ''),
    voiceId: ctx.voiceId?.trim() || process.env.XAI_TTS_VOICE?.trim() || 'eve',
    language: ctx.language?.trim() || 'en',
  }
}
