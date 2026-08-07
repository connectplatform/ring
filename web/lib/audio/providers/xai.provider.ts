import { getXaiTtsConfig } from '@/lib/audio/audio.config'
import type { SynthesizeAudioContext } from '@/lib/audio/conductor/types'

export interface XaiTtsOutput {
  buffer: Buffer
  contentType: string
  voiceId: string
}

export async function synthesizeXaiSpeech(ctx: SynthesizeAudioContext): Promise<XaiTtsOutput> {
  const config = getXaiTtsConfig(ctx)
  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }
  if (!ctx.text?.trim()) {
    throw new Error('text is required for TTS')
  }

  const response = await fetch(`${config.baseUrl}/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: ctx.text.trim(),
      voice_id: config.voiceId,
      language: config.language,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `xAI TTS failed (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) {
    throw new Error('xAI TTS returned empty audio')
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  return {
    buffer,
    contentType,
    voiceId: config.voiceId,
  }
}
