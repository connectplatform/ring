export const UPLOAD_PURPOSES = [
  'profile:avatar',
  'profile:kyc',
  'profile:cv',
  'chat:attachment',
  'opportunity:cv',
  'entity:logo',
  'vendor:logo',
  'vendor:product-media',
  'nft:media',
  'mood:track',
  'refmagic:temp-docx',
  'verification:document',
] as const

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

export type UploadAuthMode = 'public' | 'authenticated'

export interface UploadScopeMetadata {
  tenantSlug?: string
  conversationId?: string
  opportunityId?: string
  entityId?: string
  vendorEntityId?: string
  productId?: string
  mediaIndex?: string
  fileType?: string
  fileCategory?: string
}

export interface UploadMetaInput {
  purpose: UploadPurpose | string
  scope?: UploadScopeMetadata
  fileType?: string
  fileCategory?: string
  fileName?: string
}

export interface UploadActorContext {
  userId?: string
  role?: string
}

export interface UnifiedUploadInput {
  file: File
  meta: UploadMetaInput
  actor?: UploadActorContext
  tenantSlug?: string
}

import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'

export interface NormalizedUploadResult {
  success: true
  purpose: UploadPurpose | string
  url: string
  downloadUrl: string
  filename: string
  size: number
  contentType: string
  uploadedAt: string
  provider: string
  objectKey: string
  /** RingBase UUID when provider is ring_filebase. */
  fileId?: string
  /** RingBase ladder when requested and generated. */
  derivatives?: MediaDerivatives
  scope?: UploadScopeMetadata
  fileType?: string
  fileCategory?: string
}

export interface UploadErrorResult {
  success: false
  statusCode: number
  error: string
  reasonCode: string
  scope?: UploadScopeMetadata
}

export type UnifiedUploadOutput = NormalizedUploadResult | UploadErrorResult
