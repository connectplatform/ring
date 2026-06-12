import { getXaiConfig } from '@/lib/images/image.config'
import type { GenerateImageContext, ProviderImageOutput } from '@/lib/images/conductor/types'

interface XaiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string }
}

export async function generateXaiImages(ctx: GenerateImageContext): Promise<ProviderImageOutput[]> {
  const config = getXaiConfig(ctx)
  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }

  const response = await fetch(`${config.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      prompt: ctx.prompt,
      n: config.n,
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution,
      response_format: 'b64_json',
      ...(ctx.seed != null ? { seed: ctx.seed } : {}),
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as XaiImageResponse
  if (!response.ok) {
    throw new Error(payload.error?.message || `xAI image generation failed (${response.status})`)
  }

  const items = payload.data ?? []
  const outputs: ProviderImageOutput[] = []

  for (const item of items) {
    if (!item.b64_json) continue
    outputs.push({
      buffer: Buffer.from(item.b64_json, 'base64'),
      contentType: 'image/png',
      provider: 'xai',
      model: config.model,
      seed: ctx.seed,
    })
  }

  if (outputs.length === 0) {
    throw new Error('xAI returned no image data')
  }

  return outputs
}
