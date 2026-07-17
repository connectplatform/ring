export interface SunoMusicOutput {
  buffer: Buffer
  contentType: string
  externalId?: string
  audioUrl?: string
}

export interface GenerateSunoMusicContext {
  lyrics: string
  style: string
  title: string
  makeInstrumental?: boolean
  model?: string
  negativeTags?: string
}

function getSunoConfig() {
  return {
    apiKey: process.env.SUNO_API_KEY?.trim() ?? '',
    baseUrl: (process.env.SUNO_API_BASE_URL?.trim() || 'https://api.sunoapi.org').replace(/\/$/, ''),
    model: process.env.SUNO_MODEL?.trim() || 'V4',
  }
}

export function isSunoMusicEnabled(): boolean {
  if (process.env.MOOD_MUSIC_GEN_ENABLED === 'false') return false
  return Boolean(process.env.SUNO_API_KEY?.trim())
}

/**
 * Suno-compatible custom generate → download first completed audio.
 * Compatible with common gateway shapes (sunoapi.org / gcui-art style).
 */
export async function generateSunoMusic(ctx: GenerateSunoMusicContext): Promise<SunoMusicOutput> {
  const config = getSunoConfig()
  if (!config.apiKey) {
    throw new Error('SUNO_API_KEY is not configured')
  }
  if (!ctx.lyrics?.trim() && !ctx.makeInstrumental) {
    throw new Error('lyrics are required unless instrumental')
  }
  if (!ctx.style?.trim()) {
    throw new Error('style / mood tags are required')
  }

  const generateUrl = `${config.baseUrl}/api/custom_generate`
  const response = await fetch(generateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt: ctx.lyrics.trim(),
      tags: ctx.style.trim(),
      title: ctx.title.trim() || 'Untitled',
      make_instrumental: Boolean(ctx.makeInstrumental),
      model: ctx.model || config.model,
      wait_audio: true,
      negative_tags: ctx.negativeTags?.trim() || undefined,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `Suno generate failed (${response.status})`)
  }

  const payload = (await response.json()) as unknown
  const clips = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: unknown[] }).data)
      : payload && typeof payload === 'object'
        ? [payload]
        : []

  const first = clips.find((c) => {
    if (!c || typeof c !== 'object') return false
    const row = c as Record<string, unknown>
    return typeof row.audio_url === 'string' || typeof row.audioUrl === 'string'
  }) as Record<string, unknown> | undefined

  if (!first) {
    throw new Error('Suno generate returned no audio clips')
  }

  const audioUrl = String(first.audio_url || first.audioUrl || '')
  if (!audioUrl) {
    throw new Error('Suno clip missing audio_url')
  }

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    throw new Error(`Failed to download Suno audio (${audioRes.status})`)
  }
  const arrayBuffer = await audioRes.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) {
    throw new Error('Suno audio download was empty')
  }

  return {
    buffer,
    contentType: audioRes.headers.get('content-type') || 'audio/mpeg',
    externalId: String(first.id || first.clip_id || ''),
    audioUrl,
  }
}
