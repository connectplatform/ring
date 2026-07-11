import { getXaiConfig } from '@/lib/images/image.config'
import type { GenerateImageContext, ProviderImageOutput } from '@/lib/images/conductor/types'

interface XaiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string }
}

/**
 * xAI Grok Imagine — generations or edits (when referenceImages present).
 * Reference format: data URI or HTTPS URL per docs.x.ai images/edits.
 */
export async function generateXaiImages(ctx: GenerateImageContext): Promise<ProviderImageOutput[]> {
  const config = getXaiConfig(ctx)
  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }

  const refs = (ctx.referenceImages ?? [])
    .map((r) => r.url?.trim())
    .filter((url): url is string => Boolean(url))
    .slice(0, 3)

  const useEdits = refs.length > 0
  const endpoint = useEdits ? '/images/edits' : '/images/generations'

  const body: Record<string, unknown> = {
    model: config.model,
    prompt: ctx.prompt,
    n: config.n,
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution,
    response_format: 'b64_json',
    ...(ctx.seed != null ? { seed: ctx.seed } : {}),
  }

  if (useEdits) {
    if (refs.length === 1) {
      body.image = { url: refs[0], type: 'image_url' }
    } else {
      body.images = refs.map((url) => ({ url, type: 'image_url' }))
    }
  }

  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as XaiImageResponse
  if (!response.ok) {
    throw new Error(payload.error?.message || `xAI image ${useEdits ? 'edit' : 'generation'} failed (${response.status})`)
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
