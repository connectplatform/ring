import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import { getAudioProvider, getAudioStoragePrefix, isTtsEnabled } from '@/lib/audio/audio.config'
import { synthesizeXaiSpeech } from '@/lib/audio/providers/xai.provider'
import type {
  AudioProviderId,
  SynthesizeAudioContext,
  SynthesizeAudioResult,
} from '@/lib/audio/conductor/types'

function buildObjectKey(): string {
  const prefix = getAudioStoragePrefix()
  const stamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  return `${prefix}/${stamp}-${suffix}.mp3`
}

async function synthesizeFromProvider(provider: AudioProviderId, ctx: SynthesizeAudioContext) {
  if (provider !== 'xai') {
    throw new Error(`Unsupported audio provider: ${provider}`)
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
}
