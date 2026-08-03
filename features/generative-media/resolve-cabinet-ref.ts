import 'server-only'

import { randomUUID } from 'crypto'
import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'
import { fetchCabinetUpstream } from '@/features/file-cabinet/download-upstream'
import * as FileCabinet from '@/features/file-cabinet/service'
import { toImageDataUri } from '@/lib/images/to-image-data-uri'
import { file } from '@/lib/file'
import { getCabinetStorageConfig } from '@/lib/storage/storage-config'

const MAX_PROVIDER_BYTES = 20 * 1024 * 1024

export type ResolveCabinetRefPurpose = 'image' | 'video'

export type ResolveCabinetRefResult = {
  success: boolean
  /** ImageConductor / edits — data URI only */
  dataUri?: string
  /** VideoConductor i2v — HTTPS URL xAI can fetch (never private cabinet download) */
  httpsUrl?: string
  mime?: string
  error?: string
}

function parseCabinetNodeId(ref: string): string | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  // Bare UUID-ish node id
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed
  }
  try {
    const base = trimmed.startsWith('http') ? trimmed : `https://local.invalid${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
    const url = new URL(base)
    if (
      url.pathname === FILE_CABINET_DOWNLOAD_PATH ||
      url.pathname.endsWith(FILE_CABINET_DOWNLOAD_PATH)
    ) {
      return url.searchParams.get('nodeId')
    }
  } catch {
    /* ignore */
  }
  const q = trimmed.match(/[?&]nodeId=([^&]+)/)
  if (q?.[1]) return decodeURIComponent(q[1])
  return null
}

function isPublicHttps(ref: string): boolean {
  if (!ref.startsWith('https://')) return false
  // Never treat same-origin private cabinet download as public
  if (ref.includes(FILE_CABINET_DOWNLOAD_PATH)) return false
  return true
}

async function bytesFromResponse(response: Response): Promise<Uint8Array> {
  const buf = Buffer.from(await response.arrayBuffer())
  return new Uint8Array(buf)
}

/**
 * Resolve a gallery / cabinet / paste reference for provider APIs.
 * - Image path → `data:image/...;base64,...`
 * - Video path → HTTPS CDN/public URL (upload via `file()` when needed)
 * Never returns `/api/file-cabinet/download` for provider consumption.
 */
export async function resolveCabinetRefToProviderUrl(params: {
  userId: string
  ref: string
  purpose: ResolveCabinetRefPurpose
}): Promise<ResolveCabinetRefResult> {
  const ref = params.ref?.trim()
  if (!ref) return { success: false, error: 'Reference image required' }

  const maxBytes = Math.min(getCabinetStorageConfig().maxFileSize, MAX_PROVIDER_BYTES)

  if (ref.startsWith('data:image/')) {
    const comma = ref.indexOf(',')
    if (comma < 0) return { success: false, error: 'Invalid data URI' }
    const meta = ref.slice(0, comma)
    const b64 = ref.slice(comma + 1)
    const mimeMatch = meta.match(/^data:([^;]+)/)
    const mime = mimeMatch?.[1] || 'image/png'
    const buffer = Buffer.from(b64, 'base64')
    if (buffer.length > maxBytes) {
      return { success: false, error: `Image exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit` }
    }
    if (params.purpose === 'image') {
      return { success: true, dataUri: ref, mime }
    }
    // Video: upload data URI → HTTPS
    const uploaded = await file().upload(`genmedia-i2v/${params.userId}/${randomUUID()}.png`, buffer, {
      access: 'public',
      contentType: mime,
      ringbaseType: 'image',
      derivativesProfile: 'none',
    })
    if (!uploaded.success || !uploaded.url) {
      return { success: false, error: uploaded.error || 'Failed to publish reference image' }
    }
    return { success: true, httpsUrl: uploaded.url, mime }
  }

  if (isPublicHttps(ref)) {
    if (params.purpose === 'video') {
      return { success: true, httpsUrl: ref }
    }
    try {
      const response = await fetch(ref, { method: 'GET', cache: 'no-store' })
      if (!response.ok) {
        return { success: false, error: `Failed to fetch reference image (${response.status})` }
      }
      const bytes = await bytesFromResponse(response)
      if (bytes.byteLength > maxBytes) {
        return { success: false, error: `Image exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit` }
      }
      const mime =
        response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
      if (!mime.startsWith('image/')) {
        return { success: false, error: 'Reference must be an image' }
      }
      return { success: true, dataUri: toImageDataUri(bytes, mime), mime }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reference image',
      }
    }
  }

  const nodeId = parseCabinetNodeId(ref)
  if (!nodeId) {
    return { success: false, error: 'Unsupported reference image URL' }
  }

  try {
    const node = await FileCabinet.getNode(params.userId, nodeId)
    if (!node) return { success: false, error: 'File not found' }
    if (!node.mime?.startsWith('image/')) {
      return { success: false, error: 'Reference must be an image' }
    }

    const upstream = await fetchCabinetUpstream(node, { variant: 'original_webp' })
    const bytes = await bytesFromResponse(upstream.response)
    if (bytes.byteLength > maxBytes) {
      return { success: false, error: `Image exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit` }
    }
    const mime = (upstream.contentType || node.mime || 'image/jpeg').split(';')[0]!.trim()

    if (params.purpose === 'image') {
      return { success: true, dataUri: toImageDataUri(bytes, mime), mime }
    }

    // Prefer existing public storage URL when available
    if (node.storageUrl?.startsWith('https://') && !node.storageUrl.includes(FILE_CABINET_DOWNLOAD_PATH)) {
      // Private RingBase URLs may still need re-upload as public for xAI
      const publicBase = (process.env.RINGBASE_PUBLIC_URL || '').replace(/\/+$/, '')
      if (publicBase && node.storageUrl.startsWith(publicBase)) {
        // ACL-private originals: always re-upload public copy for provider
      }
    }

    const uploaded = await file().upload(
      `genmedia-i2v/${params.userId}/${node.id}-${randomUUID()}.bin`,
      Buffer.from(bytes),
      {
        access: 'public',
        contentType: mime,
        ringbaseType: 'image',
        derivativesProfile: 'none',
      },
    )
    if (!uploaded.success || !uploaded.url) {
      return { success: false, error: uploaded.error || 'Failed to publish reference image' }
    }
    return { success: true, httpsUrl: uploaded.url, mime }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve cabinet image',
    }
  }
}
