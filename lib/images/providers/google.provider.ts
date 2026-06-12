import { getGoogleConfig } from '@/lib/images/image.config'
import type { GenerateImageContext, ProviderImageOutput } from '@/lib/images/conductor/types'

interface GooglePredictResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string
    mimeType?: string
    prompt?: string
  }>
  error?: { message?: string; status?: string }
}

export async function generateGoogleImages(ctx: GenerateImageContext): Promise<ProviderImageOutput[]> {
  const config = getGoogleConfig(ctx)
  if (!config.apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY is not configured')
  }

  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:predict`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt: ctx.prompt }],
      parameters: {
        sampleCount: config.n,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
      },
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as GooglePredictResponse
  if (!response.ok) {
    throw new Error(payload.error?.message || `Google Imagen generation failed (${response.status})`)
  }

  const predictions = payload.predictions ?? []
  const outputs: ProviderImageOutput[] = []

  for (const prediction of predictions) {
    if (!prediction.bytesBase64Encoded) continue
    outputs.push({
      buffer: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
      contentType: prediction.mimeType || 'image/png',
      provider: 'google',
      model: config.model,
      enhancedPrompt: prediction.prompt,
      seed: ctx.seed,
    })
  }

  if (outputs.length === 0) {
    throw new Error('Google Imagen returned no image data')
  }

  return outputs
}
