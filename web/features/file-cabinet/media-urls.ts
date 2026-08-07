import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'

/** RingFileBase derivative object suffixes (`{fileId}_v_{suffix}`). */
export type CabinetImageVariant =
  | 'thumb'
  | 'sync_thumb'
  | 'original_webp'
  | 'card'
  | 'blur'

const VARIANT_OBJECT: Record<CabinetImageVariant, string> = {
  thumb: 'thumb.webp',
  sync_thumb: 'sync_thumb.jpg',
  original_webp: 'original.webp',
  card: 'card_640.webp',
  blur: 'blur.webp',
}

export function cabinetVariantObjectKey(variant: CabinetImageVariant): string {
  return VARIANT_OBJECT[variant]
}

export function cabinetDownloadUrl(
  nodeId: string,
  opts?: { inline?: boolean; variant?: CabinetImageVariant },
): string {
  const q = new URLSearchParams({ nodeId })
  if (opts?.inline) q.set('inline', '1')
  if (opts?.variant) q.set('variant', opts.variant)
  return `${FILE_CABINET_DOWNLOAD_PATH}?${q.toString()}`
}

/**
 * Rewrite a public RingBase `/files/{fileId}` URL to a derivative key.
 * Used on public gallery (no session ACL proxy) — prefer WebP ladders over original PNG/JPEG.
 */
export function publicCdnVariantUrl(
  storageUrl: string | undefined | null,
  variant: CabinetImageVariant,
): string {
  if (!storageUrl?.trim()) return ''
  try {
    const [pathPart, query = ''] = storageUrl.split('?')
    const parts = pathPart.split('/')
    const last = parts[parts.length - 1] || ''
    if (!last) return storageUrl
    const fileId = last.includes('_v_') ? last.split('_v_')[0] : last
    parts[parts.length - 1] = `${fileId}_v_${cabinetVariantObjectKey(variant)}`
    return query ? `${parts.join('/')}?${query}` : parts.join('/')
  } catch {
    return storageUrl
  }
}
