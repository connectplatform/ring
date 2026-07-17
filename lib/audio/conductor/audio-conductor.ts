import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import {
  getAudioProvider,
  getAudioStoragePrefix,
  getMoodMusicStoragePrefix,
  isMoodMusicGenEnabled,
  isTtsEnabled,
} from '@/lib/audio/audio.config'
import { synthesizeXaiSpeech } from '@/lib/audio/providers/xai.provider'
import { generateSunoMusic } from '@/lib/audio/providers/suno.provider'
import type {
  AudioProviderId,
  GenerateMusicContext,
  GenerateMusicResult,
  SynthesizeAudioContext,
  SynthesizeAudioResult,
} from '@/lib/audio/conductor/types'

function buildObjectKey(): string {
  const prefix = getAudioStoragePrefix()
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${stamp}-${suffix}.mp3`
}

function buildMoodMusicObjectKey(): string {
  const prefix = getMoodMusicStoragePrefix()
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${stamp}-${suffix}.mp3`
}

async function synthesizeFromProvider(provider: AudioProviderId, ctx: SynthesizeAudioContext) {
  if (provider !== 'xai') {
    throw new Error(`Unsupported TTS provider: ${provider}`)
  }
  return synthesizeXaiSpeech(ctx)
}

export const AudioConductor = {
  async synthesize(ctx: SynthesizeAudioContext): Promise<SynthesizeAudioResult> {
    if (!isTtsEnabled()) {
      return { success: false, error: 'TTS is disabled (XAI_TTS_ENABLED=false)' }
    }
    if (!ctx.text?.trim()) {
      return { success: false, error: 'text is required' }
    }

    try {
      const provider = getAudioProvider(ctx.provider)
      const output = await synthesizeFromProvider(provider, ctx)
      const objectKey = buildObjectKey()
      const upload = await file().upload(objectKey, output.buffer, {
        access: 'public',
        contentType: output.contentType,
        metadata: {
          source: provider,
          voiceId: output.voiceId,
        },
      })

      if (!upload.success || !upload.url) {
        return { success: false, error: upload.error || 'Failed to upload audio to ring-filebase' }
      }

      return {
        success: true,
        url: upload.url,
        objectKey,
        provider,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  },

  /**
   * Generate a music arrangement (Suno-compatible) and persist via file() → ring-filebase.
   */
  async generateMusic(ctx: GenerateMusicContext): Promise<GenerateMusicResult> {
    if (!isMoodMusicGenEnabled()) {
      return {
        success: false,
        error: 'Mood music generation is disabled (set SUNO_API_KEY and MOOD_MUSIC_GEN_ENABLED)',
      }
    }
    if (!ctx.style?.trim()) {
      return { success: false, error: 'style is required' }
    }
    if (!ctx.makeInstrumental && !ctx.lyrics?.trim()) {
      return { success: false, error: 'lyrics are required unless instrumental' }
    }

    try {
      const output = await generateSunoMusic({
        lyrics: ctx.lyrics || '',
        style: ctx.style,
        title: ctx.title || 'Untitled',
        makeInstrumental: ctx.makeInstrumental,
        model: ctx.model,
        negativeTags: ctx.negativeTags,
      })
      const objectKey = buildMoodMusicObjectKey()
      const upload = await file().upload(objectKey, output.buffer, {
        access: 'public',
        contentType: output.contentType,
        ringbaseType: 'media',
        derivativesProfile: 'none',
        metadata: {
          source: 'suno',
          title: ctx.title || 'Untitled',
          style: ctx.style.slice(0, 200),
          actorId: ctx.actorId || '',
          externalId: output.externalId || '',
        },
      })

      if (!upload.success || !upload.url) {
        return { success: false, error: upload.error || 'Failed to upload mood audio to ring-filebase' }
      }

      return {
        success: true,
        url: upload.url,
        objectKey,
        fileId: upload.fileId,
        provider: 'suno',
        externalId: output.externalId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  },
}
