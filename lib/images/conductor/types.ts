export type ImageProviderId = 'xai' | 'google'

export interface GenerateImageContext {
  prompt: string
  provider?: ImageProviderId
  model?: string
  aspectRatio?: string
  resolution?: string
  n?: number
  seed?: number
  purpose?: string
  refCode?: string
  actorId?: string
  /**
   * Reference images for xAI /images/edits (up to 3).
   * Prefer data:image/png;base64,... (favicon.png-data-uint) or public HTTPS URLs.
   */
  referenceImages?: Array<{ url: string }>
}

export interface ProviderImageOutput {
  buffer: Buffer
  contentType: string
  provider: ImageProviderId
  model: string
  enhancedPrompt?: string
  seed?: number
}

export interface GeneratedImage {
  url: string
  fileId?: string
  size: number
  contentType: string
  recordId: string
}

export interface GenerateImageResult {
  success: boolean
  provider?: ImageProviderId
  model?: string
  prompt?: string
  images?: GeneratedImage[]
  error?: string
}

export interface GeneratedImageRecord {
  actorId?: string
  provider: ImageProviderId
  model: string
  prompt: string
  enhancedPrompt?: string
  aspectRatio?: string
  resolution?: string
  purpose?: string
  refCode?: string
  url: string
  fileId?: string
  size: number
  createdAt: string
}
