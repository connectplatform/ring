import 'server-only'

/**
 * ACL-gated upstream fetch for cabinet private downloads.
 * LegioX SSOT: ringbase-download-proxy-pattern (Zemna RefMagic) —
 * never hand the browser an internal CDN URL; stream same-origin after session ACL.
 *
 * Upstream resolution order:
 * 1. RINGBASE_CDN_INTERNAL_URL/files/{fileId}[_v_*] (in-cluster, preferred)
 * 2. node.storageUrl (RINGBASE_PUBLIC_URL/files/{uuid}) — original only
 * 3. RINGBASE_PUBLIC_URL/files/{fileId}[_v_*]
 */

import {
  cabinetVariantObjectKey,
  type CabinetImageVariant,
} from '@/features/file-cabinet/media-urls'

function extractFileId(node: { storageFileId?: string; storageUrl?: string }): string | null {
  if (node.storageFileId?.trim()) return node.storageFileId.trim()
  if (!node.storageUrl) return null
  try {
    const raw = node.storageUrl.split('?')[0]
    const parts = raw.split('/')
    const last = parts[parts.length - 1] || ''
    return last.includes('_v_') ? last.split('_v_')[0] : last || null
  } catch {
    return null
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180) || 'download'
}

const VARIANT_FALLBACKS: CabinetImageVariant[] = [
  'thumb',
  'sync_thumb',
  'original_webp',
  'card',
]

export async function fetchCabinetUpstream(
  node: { storageFileId?: string; storageUrl?: string; mime?: string; name: string },
  opts?: { variant?: CabinetImageVariant },
): Promise<{ response: Response; filename: string; contentType: string }> {
  const fileId = extractFileId(node)
  const internalBase = (process.env.RINGBASE_CDN_INTERNAL_URL || '').replace(/\/+$/, '')
  const publicBase = (process.env.RINGBASE_PUBLIC_URL || '').replace(/\/+$/, '')

  const candidates: string[] = []
  const pushFile = (idSuffix: string) => {
    if (internalBase) candidates.push(`${internalBase}/files/${idSuffix}`)
    if (publicBase) candidates.push(`${publicBase}/files/${idSuffix}`)
  }

  if (opts?.variant && fileId) {
    const wanted = [opts.variant, ...VARIANT_FALLBACKS.filter((v) => v !== opts.variant)]
    for (const v of wanted) {
      pushFile(`${fileId}_v_${cabinetVariantObjectKey(v)}`)
    }
  }

  if (fileId) pushFile(fileId)
  if (node.storageUrl && !opts?.variant) candidates.push(node.storageUrl)
  else if (node.storageUrl && opts?.variant) {
    // keep original as last resort after derivatives
    candidates.push(node.storageUrl)
  }

  let lastStatus = 502
  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-store' })
      if (response.ok && response.body) {
        return {
          response,
          filename: sanitizeFilename(node.name),
          contentType:
            response.headers.get('content-type') ||
            node.mime ||
            'application/octet-stream',
        }
      }
      lastStatus = response.status
    } catch {
      lastStatus = 502
    }
  }

  throw Object.assign(new Error('Upstream file unavailable'), { status: lastStatus })
}
