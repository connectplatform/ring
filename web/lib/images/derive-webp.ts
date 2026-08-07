import 'server-only'

import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import { RingBaseAdapter } from '@/lib/file/adapters/RingBaseAdapter'
import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'
import { webpAliasFromDerivatives } from '@/lib/file/media-asset'
import { getWebpDerivativeConfig } from '@/lib/ring-config-core'

export type DeriveWebpResult = {
  success: boolean
  webpUrl?: string
  fileId?: string
  derivatives?: MediaDerivatives
  skipped?: boolean
  error?: string
}

let warnedRingbaseUnavailable = false
let warnedSharpFailure = false

function extractFileIdFromUrl(url: string): string | undefined {
  try {
    const raw = url.split('?')[0]
    const parts = raw.split('/')
    const filesIndex = parts.indexOf('files')
    const last =
      filesIndex !== -1 && filesIndex < parts.length - 1
        ? parts[filesIndex + 1]
        : parts[parts.length - 1]
    if (!last) return undefined
    return last.includes('_v_') ? last.split('_v_')[0] : last
  } catch {
    return undefined
  }
}

export async function isWebpDeriveAvailable(): Promise<boolean> {
  if (process.env.IMAGE_WEBP_DISABLED === '1') return false
  const { provider } = getWebpDerivativeConfig()
  if (provider === 'off') return false
  if (provider === 'ringbase') return true
  if (provider === 'sharp') {
    try {
      await import('sharp')
      return true
    } catch {
      return false
    }
  }
  return false
}

async function deriveWithSharp(
  buffer: Buffer,
  maxEdge: number,
  quality: number,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer()
}

async function deriveWithRingbase(params: {
  sourceUrl: string
  purpose?: string
  fileId?: string
}): Promise<DeriveWebpResult> {
  const fileId = params.fileId || extractFileIdFromUrl(params.sourceUrl)
  if (!fileId) {
    return { success: false, error: 'Could not extract RingBase fileId from sourceUrl' }
  }

  const purpose = (params.purpose || '').toLowerCase()
  const profile =
    purpose.startsWith('news')
      ? 'news'
      : purpose.includes('vendor') || purpose.includes('product') || purpose.includes('store')
        ? 'product'
        : 'gallery'

  const adapter = new RingBaseAdapter()
  const result = await adapter.deriveDerivatives({
    fileId,
    profile,
    sourceUrl: params.sourceUrl,
  })

  if (result.skipped) {
    if (!warnedRingbaseUnavailable) {
      warnedRingbaseUnavailable = true
      console.warn(
        'deriveWebpSibling: RingBase derivatives endpoint unavailable — soft-skip',
      )
    }
    return { success: true, skipped: true, fileId }
  }

  if (!result.success) {
    return { success: false, fileId, error: result.error || 'RingBase derive failed' }
  }

  const derivatives = result.derivatives
  const webpUrl = webpAliasFromDerivatives(derivatives)
  if (!webpUrl) {
    return { success: true, skipped: true, fileId, derivatives }
  }

  return { success: true, webpUrl, fileId, derivatives }
}

/**
 * Derive a suggested-size WebP sibling for raster uploads (not SVG/GIF).
 * Pass `existingDerivatives` to skip when upload already returned a RingBase map.
 */
export async function deriveWebpSibling(params: {
  sourceUrl: string
  sourceBuffer?: Buffer
  contentType?: string
  purpose?: string
  objectKeyHint?: string
  fileId?: string
  /** When upload already returned a ladder, skip second derive. */
  existingDerivatives?: MediaDerivatives
}): Promise<DeriveWebpResult> {
  if (process.env.IMAGE_WEBP_DISABLED === '1') {
    return { success: true, skipped: true }
  }

  if (params.existingDerivatives && Object.keys(params.existingDerivatives).length > 0) {
    return {
      success: true,
      skipped: true,
      fileId: params.fileId,
      derivatives: params.existingDerivatives,
      webpUrl: webpAliasFromDerivatives(params.existingDerivatives),
    }
  }

  const contentType = (params.contentType || '').toLowerCase()
  if (contentType.includes('svg') || contentType.includes('gif')) {
    return { success: true, skipped: true }
  }

  const { provider, maxEdge, quality } = getWebpDerivativeConfig()

  if (provider === 'off') {
    return { success: true, skipped: true }
  }

  if (provider === 'ringbase') {
    return deriveWithRingbase({
      sourceUrl: params.sourceUrl,
      purpose: params.purpose,
      fileId: params.fileId,
    })
  }

  try {
    let buffer = params.sourceBuffer
    if (!buffer) {
      const res = await fetch(params.sourceUrl)
      if (!res.ok) {
        return { success: false, error: `Failed to fetch source (${res.status})` }
      }
      buffer = Buffer.from(await res.arrayBuffer())
    }

    const webpBuffer = await deriveWithSharp(buffer, maxEdge, quality)

    const prefix = process.env.IMAGE_GEN_STORAGE_PREFIX?.trim() || 'generated'
    const category = (params.purpose || 'gallery').replace(/[^a-zA-Z0-9_-]/g, '_')
    const key =
      params.objectKeyHint?.replace(/\.[^.]+$/, '') ||
      `${prefix}/${category}/webp/${Date.now()}-${randomUUID().slice(0, 8)}`
    const objectKey = `${key}.webp`

    const upload = await file().upload(objectKey, webpBuffer, {
      access: 'public',
      contentType: 'image/webp',
      metadata: {
        purpose: 'webp-derivative',
        source: params.sourceUrl.slice(0, 200),
      },
    })

    if (!upload.success || !upload.url) {
      return { success: false, error: upload.error || 'WebP upload failed' }
    }

    return { success: true, webpUrl: upload.url, fileId: upload.fileId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!warnedSharpFailure) {
      warnedSharpFailure = true
      console.warn('deriveWebpSibling sharp path failed — soft-skip', message)
    }
    return { success: true, skipped: true, error: message }
  }
}
