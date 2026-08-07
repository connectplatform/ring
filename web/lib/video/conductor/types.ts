import type { ThumbnailSpec } from '@/lib/media/schemas'
import type { ImageProviderId } from '@/lib/images/conductor/types'

export type VideoQualityMode = 'draft' | 'draft_i2v' | 'production' | 'production_i2v'

export type VideoGenerationKind = 'generate' | 'edit'

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
  /** Agent-authored first-frame still prompt — auto-generates image when imageUrl absent */
  firstFramePrompt?: string
  imageProvider?: ImageProviderId
  imageModel?: string
  imageResolution?: string
  /** Optional deterministic thumbnail with text overlays on first frame */
  thumbnail?: ThumbnailSpec
  clipId?: string
  pipelineRequestId?: string
  /** Remaster/edit: existing MP4 URL from manifest or CDN — uses POST /v1/videos/edits */
  sourceVideoUrl?: string
  purpose?: string
  refCode?: string
  actorId?: string
  /** Remaster: reuse prompt from prior xAI request_id (poll-only N/A — caller passes prompt) */
  remasterFromRequestId?: string
  /** Audit: URL of draft clip being remastered */
  remasterFromVideoUrl?: string
  persistToFilebase?: boolean
  generationKind?: VideoGenerationKind
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

export interface GeneratedVideoResultAsset {
  url: string
  recordId?: string
  fileId?: string
  size?: number
  contentType?: string
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
  firstFrame?: GeneratedVideoResultAsset
  thumbnail?: GeneratedVideoResultAsset
  clipId?: string
  pipelineRequestId?: string
  remasterFromRequestId?: string
  remasterFromVideoUrl?: string
  generationKind?: VideoGenerationKind
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
  remasterFromVideoUrl?: string
  generationKind?: VideoGenerationKind
  firstFrameUrl?: string
  thumbnailUrl?: string
  clipId?: string
  pipelineRequestId?: string
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
  /** Official xAI progress 0–100 (pending 0–99, done 100; omitted on failed). */
  progress?: number | null
  video?: {
    url?: string
    duration?: number
    respect_moderation?: boolean
  }
  model?: string
  error?: { code?: string; message?: string }
}
