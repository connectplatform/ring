export type VideoQualityMode = 'draft' | 'production' | 'production_i2v'

export type VideoProviderId = 'xai'

export interface GenerateVideoContext {
  prompt: string
  qualityMode?: VideoQualityMode
  provider?: VideoProviderId
  model?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  imageUrl?: string
  purpose?: string
  refCode?: string
  actorId?: string
  /** Remaster: reuse prompt from prior xAI request_id (poll-only N/A — caller passes prompt) */
  remasterFromRequestId?: string
  persistToFilebase?: boolean
}

export interface GeneratedVideo {
  url: string
  temporaryUrl: string
  fileId?: string
  size?: number
  contentType: string
  recordId?: string
  requestId: string
  duration?: number
  respectModeration?: boolean
}

export interface GenerateVideoResult {
  success: boolean
  provider?: VideoProviderId
  model?: string
  qualityMode?: VideoQualityMode
  resolution?: string
  prompt?: string
  requestId?: string
  estimatedCostUsd?: number
  video?: GeneratedVideo
  remasterFromRequestId?: string
  error?: string
}

export interface GeneratedVideoRecord {
  actorId?: string
  provider: VideoProviderId
  model: string
  qualityMode: VideoQualityMode
  resolution: string
  prompt: string
  requestId: string
  remasterFromRequestId?: string
  purpose?: string
  refCode?: string
  url: string
  fileId?: string
  size?: number
  duration?: number
  createdAt: string
}

export interface XaiVideoPollResult {
  status: string
  video?: {
    url?: string
    duration?: number
    respect_moderation?: boolean
  }
  model?: string
  error?: { code?: string; message?: string }
}
