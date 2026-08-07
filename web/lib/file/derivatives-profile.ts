import { StorageProvider, getStorageProvider } from '@/lib/storage/storage-config'
import type { FileUploadOptions } from './interfaces/IFileService'

export type DerivativesProfile = NonNullable<FileUploadOptions['derivativesProfile']>
export type RingbaseUploadType = NonNullable<FileUploadOptions['ringbaseType']>

/**
 * True when RingBase can generate ladders (provider ring_filebase, not kill-switched).
 */
export function shouldRequestDerivatives(): boolean {
  if (process.env.IMAGE_WEBP_DISABLED === '1') return false
  try {
    return getStorageProvider() === StorageProvider.RING_FILEBASE
  } catch {
    return false
  }
}

/**
 * Map upload purpose / MIME → RingBase derivatives profile.
 * Logos use thumb (not full product ladder). Videos / private docs → none.
 */
export function resolveDerivativesProfileForPurpose(
  purpose: string | undefined,
  contentType?: string,
): DerivativesProfile {
  const ct = (contentType || '').toLowerCase()
  const p = (purpose || '').toLowerCase()

  if (ct.startsWith('video/') || ct.startsWith('audio/')) return 'none'
  if (
    p.includes('kyc') ||
    p.includes('verification') ||
    p.includes('refmagic') ||
    p === 'opportunity:cv' ||
    p.includes(':cv')
  ) {
    return 'none'
  }

  // Docs / non-images in chat
  if (p.includes('chat:attachment') || p.includes('chat')) {
    if (ct.startsWith('image/') && !ct.includes('svg')) return 'gallery'
    return 'none'
  }

  if (p.startsWith('news') || p.includes('news-')) return 'news'
  if (p === 'vendor:product-media' || p.includes('product') || p.includes('store')) {
    if (ct.startsWith('video/')) return 'none'
    return 'product'
  }
  if (p === 'nft:media' || p.includes('genmedia') || p.includes('gallery') || p.includes('nft')) {
    return 'gallery'
  }
  if (
    p === 'profile:avatar' ||
    p === 'entity:logo' ||
    p === 'vendor:logo' ||
    p.includes('avatar') ||
    p.includes('logo')
  ) {
    return 'thumb'
  }

  if (ct.startsWith('image/') && !ct.includes('svg')) return 'thumb'
  return 'none'
}

export function resolveRingbaseTypeForPurpose(
  purpose: string | undefined,
  contentType?: string,
  access?: 'public' | 'private',
): RingbaseUploadType | undefined {
  if (access === 'private') return 'document'
  const p = (purpose || '').toLowerCase()
  if (p === 'profile:avatar' || p.includes('avatar')) return 'avatar'
  const ct = (contentType || '').toLowerCase()
  if (ct.startsWith('image/')) return 'image'
  if (ct.startsWith('video/') || ct.startsWith('audio/')) return 'media'
  if (
    p.includes('kyc') ||
    p.includes('verification') ||
    p.includes('refmagic') ||
    p.includes('cv') ||
    p.includes('document')
  ) {
    return 'document'
  }
  return undefined
}

/** Bundle options for file().upload when on ring_filebase. */
export function ringbaseDerivativeUploadOptions(
  purpose: string | undefined,
  contentType?: string,
  access?: 'public' | 'private',
): Pick<FileUploadOptions, 'derivativesProfile' | 'ringbaseType'> {
  if (!shouldRequestDerivatives()) return {}
  return {
    derivativesProfile: resolveDerivativesProfileForPurpose(purpose, contentType),
    ringbaseType: resolveRingbaseTypeForPurpose(purpose, contentType, access),
  }
}
