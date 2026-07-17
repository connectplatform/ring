import type { MediaDerivatives } from './interfaces/IFileService'

/** Shared image asset for news / gallery / chat — file-layer SSOT. */
export type MediaImageAsset = {
  /** Original CDN URL (`/files/{uuid}`). */
  url: string
  /** RingBase UUID (not storage objectKey). */
  fileId?: string
  derivatives?: MediaDerivatives
}

export type MediaImageSlot =
  | 'blur'
  | 'thumb'
  | 'mobile'
  | 'card'
  | 'og'
  | 'hero'
  | 'lightbox'
  | 'square'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceDerivatives(raw: unknown): MediaDerivatives | undefined {
  if (!isRecord(raw)) return undefined
  const out: MediaDerivatives = {}
  if (typeof raw.blur === 'string') out.blur = raw.blur
  if (typeof raw.thumb === 'string') out.thumb = raw.thumb
  if (typeof raw.mobile === 'string') out.mobile = raw.mobile
  if (typeof raw.og === 'string') out.og = raw.og
  if (typeof raw.original_webp === 'string') out.original_webp = raw.original_webp
  if (typeof raw.sync_thumb === 'string') out.sync_thumb = raw.sync_thumb
  if (isRecord(raw.hero)) {
    const webp = typeof raw.hero.webp === 'string' ? raw.hero.webp : undefined
    const avif = typeof raw.hero.avif === 'string' ? raw.hero.avif : undefined
    if (webp || avif) out.hero = { webp: webp || '', avif: avif || '' }
  }
  if (isRecord(raw.card)) {
    const w640 = isRecord(raw.card.w640)
      ? {
          webp: typeof raw.card.w640.webp === 'string' ? raw.card.w640.webp : '',
          avif: typeof raw.card.w640.avif === 'string' ? raw.card.w640.avif : '',
        }
      : undefined
    const w1280 = isRecord(raw.card.w1280)
      ? {
          webp: typeof raw.card.w1280.webp === 'string' ? raw.card.w1280.webp : '',
          avif: typeof raw.card.w1280.avif === 'string' ? raw.card.w1280.avif : '',
        }
      : undefined
    if (w640 || w1280) {
      out.card = {
        w640: w640 || { webp: '', avif: '' },
        w1280: w1280 || { webp: '', avif: '' },
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Coerce string URL or partial asset object into MediaImageAsset. */
export function coerceMediaImageAsset(input: unknown): MediaImageAsset | undefined {
  if (typeof input === 'string') {
    const url = input.trim()
    return url ? { url } : undefined
  }
  if (!isRecord(input)) return undefined
  const url =
    (typeof input.url === 'string' && input.url.trim()) ||
    (typeof input.originalUrl === 'string' && input.originalUrl.trim()) ||
    ''
  if (!url) return undefined
  const fileId = typeof input.fileId === 'string' && input.fileId.trim() ? input.fileId.trim() : undefined
  const derivatives = coerceDerivatives(input.derivatives)
  return { url, ...(fileId ? { fileId } : {}), ...(derivatives ? { derivatives } : {}) }
}

export function coerceMediaImageAssetList(input: unknown): MediaImageAsset[] {
  if (!Array.isArray(input)) return []
  const out: MediaImageAsset[] = []
  for (const item of input) {
    const asset = coerceMediaImageAsset(item)
    if (asset) out.push(asset)
  }
  return out
}

/** Pick best CDN URL for a display slot; always falls back to original. */
export function pickImageSrc(
  asset: MediaImageAsset | string | null | undefined,
  slot: MediaImageSlot,
): string {
  const a = typeof asset === 'string' ? coerceMediaImageAsset(asset) : asset
  if (!a?.url) return ''
  const d = a.derivatives
  if (!d) return a.url

  switch (slot) {
    case 'blur':
      return d.blur || a.url
    case 'thumb':
      return d.thumb || d.sync_thumb || d.card?.w640?.webp || a.url
    case 'mobile':
      return d.mobile || d.card?.w1280?.webp || d.thumb || a.url
    case 'card':
      return d.card?.w640?.webp || d.thumb || d.mobile || a.url
    case 'og':
      return d.og || d.hero?.webp || a.url
    case 'hero':
      return d.hero?.webp || d.original_webp || d.mobile || a.url
    case 'lightbox':
      return d.original_webp || a.url
    case 'square':
      return d.sync_thumb || d.thumb || a.url
    default:
      return a.url
  }
}

/** Denormalized featured URL from article-like shapes. */
export function featuredImageUrl(article: {
  featuredImage?: string
  featuredImageAsset?: MediaImageAsset
}): string | undefined {
  return article.featuredImageAsset?.url || article.featuredImage || undefined
}

/** Compat WebP alias from a derivatives map. */
export function webpAliasFromDerivatives(d?: MediaDerivatives): string | undefined {
  return d?.original_webp || d?.thumb || d?.mobile
}
