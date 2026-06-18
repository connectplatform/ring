import type { XaiVideoPollResult } from '@/lib/video/conductor/types'
import { getXaiVideoConfig } from '@/lib/video/video.config'

export interface StartXaiVideoInput {
  prompt: string
  qualityMode?: Parameters<typeof getXaiVideoConfig>[0]['qualityMode']
  model?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  imageUrl?: string
}

export async function startXaiVideoGeneration(input: StartXaiVideoInput): Promise<string> {
  const config = getXaiVideoConfig(input)

  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }
  if (config.requiresImageUrl && !input.imageUrl?.trim()) {
    throw new Error(`${config.model} requires imageUrl (image-to-video only)`)
  }
  if (!config.supportsTextToVideo && !input.imageUrl?.trim()) {
    throw new Error(`${config.model} does not support text-to-video; provide imageUrl`)
  }

  const body: Record<string, unknown> = {
    model: config.model,
    prompt: input.prompt,
    duration: config.duration,
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution,
  }

  if (input.imageUrl?.trim()) {
    body.image = { url: input.imageUrl.trim() }
  }

  const response = await fetch(`${config.baseUrl}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    request_id?: string
    error?: { message?: string }
    message?: string
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `xAI video start failed (${response.status})`)
  }

  if (!payload.request_id) {
    throw new Error('xAI video start returned no request_id')
  }

  return payload.request_id
}

export async function pollXaiVideo(
  requestId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<XaiVideoPollResult> {
  const config = getXaiVideoConfig({})
  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }

  const timeoutMs = options?.timeoutMs ?? 15 * 60 * 1000
  const intervalMs = options?.intervalMs ?? 5000
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${config.baseUrl}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' },
    })

    const data = (await response.json().catch(() => ({}))) as XaiVideoPollResult
    if (!response.ok) {
      throw new Error(data.error?.message || `xAI video poll failed (${response.status})`)
    }

    if (data.status === 'done') return data
    if (data.status === 'failed' || data.status === 'expired') {
      throw new Error(`Video ${data.status}: ${JSON.stringify(data.error || data)}`)
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timeout waiting for video ${requestId}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
