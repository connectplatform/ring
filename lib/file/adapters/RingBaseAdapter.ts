import {
  IFileService,
  FileUploadOptions,
  FileUploadResult,
  FileDeleteResult,
  FileMetadata,
} from '../interfaces/IFileService'

/** Basename for multipart filename — RingBase keys are UUID; originalName should still carry an extension. */
function multipartFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() || 'upload.bin'
  return base.includes('.') ? base : `${base}.bin`
}

export type RingBaseUploadType = 'image' | 'media' | 'document' | 'avatar' | 'other'

export type DerivativesProfile = 'none' | 'thumb' | 'gallery' | 'product' | 'news'

export function resolveRingBaseUploadType(opts: {
  contentType: string
  access?: 'public' | 'private'
  typeOverride?: RingBaseUploadType
}): RingBaseUploadType {
  if (opts.typeOverride) return opts.typeOverride
  if (opts.access === 'private') return 'document'
  const ct = opts.contentType.toLowerCase()
  if (ct.startsWith('image/')) return 'image'
  if (ct.startsWith('video/') || ct.startsWith('audio/')) return 'media'
  return 'other'
}

/**
 * RingFileBase CDN adapter — self-hosted Ceph/RGW via ring-filebase-api.
 *
 * Public URLs are extensionless `/files/{uuid}` for originals; derivatives use `/files/{uuid}_v_*`.
 */
export class RingBaseAdapter implements IFileService {
  private apiUrl: string
  private apiToken?: string

  constructor(apiUrl?: string, apiToken?: string) {
    const defaultApiUrl =
      process.env.RINGBASE_API_URL || process.env.NEXT_PUBLIC_RINGBASE_API_URL || ''
    const raw = (apiUrl || defaultApiUrl || 'http://ring-filebase-api.ring-filebase.svc.cluster.local')
      .replace(/\/+$/, '')
    this.apiUrl = raw.includes('/api/v1') ? raw : `${raw}/api/v1`
    this.apiToken = apiToken || process.env.RINGBASE_API_TOKEN
  }

  private endpoint(path: string): string {
    const suffix = path.startsWith('/') ? path : `/${path}`
    return `${this.apiUrl}${suffix}`
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.apiToken) headers.Authorization = `Bearer ${this.apiToken}`
    return headers
  }

  async upload(
    filename: string,
    file: File | Buffer,
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    try {
      const formData = new FormData()
      const contentType =
        options.contentType ||
        (file instanceof File ? file.type : undefined) ||
        'application/octet-stream'
      const bytes =
        file instanceof Buffer
          ? new Uint8Array(file)
          : new Uint8Array(await (file as File).arrayBuffer())
      const fileToUpload = new Blob([bytes], { type: contentType })

      formData.append('file', fileToUpload, multipartFilename(filename))
      const uploadType = resolveRingBaseUploadType({
        contentType,
        access: options.access,
        typeOverride: options.ringbaseType,
      })
      formData.append('type', uploadType)

      const profile = options.derivativesProfile
      if (profile) formData.append('derivatives', profile)

      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata))
      }

      const response = await fetch(this.endpoint('/upload'), {
        method: 'POST',
        headers: this.authHeaders(),
        body: formData,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        const detail = body.slice(0, 280).replace(/\s+/g, ' ').trim()
        throw new Error(
          `RingBase upload failed: ${response.status} ${response.statusText}` +
            (detail ? ` — ${detail}` : '') +
            ` (POST ${this.endpoint('/upload')})`,
        )
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      return {
        success: true,
        url: result.url,
        downloadUrl: result.url,
        filename,
        size: result.metadata?.size || fileToUpload.size,
        contentType: result.metadata?.mimeType || fileToUpload.type,
        uploadedAt: new Date().toISOString(),
        fileId: result.fileId,
        derivatives: result.derivatives,
      }
    } catch (error) {
      console.error('RingBaseAdapter upload error:', error)
      return {
        success: false,
        url: '',
        filename,
        size: 0,
        contentType: '',
        uploadedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown upload error',
      }
    }
  }

  /**
   * Request RingBase-native size ladder for an existing file.
   * POST /api/v1/files/:fileId/derivatives — returns skipped until route is wired in API image.
   */
  async deriveDerivatives(params: {
    fileId: string
    profile: DerivativesProfile
    sourceUrl?: string
  }): Promise<{ success: boolean; derivatives?: FileUploadResult['derivatives']; skipped?: boolean; error?: string }> {
    try {
      const response = await fetch(this.endpoint(`/files/${params.fileId}/derivatives`), {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: params.profile,
          sourceUrl: params.sourceUrl,
        }),
      })
      if (response.status === 404) {
        return { success: true, skipped: true }
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { success: false, error: body.slice(0, 200) || response.statusText }
      }
      const result = await response.json()
      if (!result.success) return { success: false, error: result.error || 'derive failed' }
      return { success: true, derivatives: result.derivatives }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async delete(url: string): Promise<FileDeleteResult> {
    try {
      const fileId = this.extractFileIdFromUrl(url)
      const response = await fetch(this.endpoint(`/files/${fileId}`), {
        method: 'DELETE',
        headers: this.authHeaders(),
      })

      if (!response.ok) {
        throw new Error(`RingBase delete failed: ${response.statusText}`)
      }

      const result = await response.json()
      return { success: result.success, error: result.error }
    } catch (error) {
      console.error('RingBaseAdapter delete error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      }
    }
  }

  async getMetadata(url: string): Promise<FileMetadata | null> {
    try {
      const fileId = this.extractFileIdFromUrl(url)
      const response = await fetch(this.endpoint(`/files/${fileId}/metadata`), {
        method: 'GET',
        headers: this.authHeaders(),
      })

      if (!response.ok) return null
      const result = await response.json()
      if (!result.success || !result.file) return null
      const file = result.file
      return {
        filename: file.filename || this.extractFilenameFromUrl(url),
        size: file.size,
        contentType: file.contentType || file.mimeType,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        url,
        downloadUrl: url,
      }
    } catch (error) {
      console.error('RingBaseAdapter getMetadata error:', error)
      return null
    }
  }

  private extractFileIdFromUrl(url: string): string {
    try {
      const raw = url.split('?')[0]
      const urlParts = raw.split('/')
      const filesIndex = urlParts.indexOf('files')
      const last = urlParts[urlParts.length - 1]
      // Strip derivative suffix for delete of original: uuid_v_thumb.webp → need original uuid
      if (filesIndex !== -1 && filesIndex < urlParts.length - 1) {
        const id = last.includes('_v_') ? last.split('_v_')[0] : last
        return id
      }
      return last.includes('_v_') ? last.split('_v_')[0] : last
    } catch {
      throw new Error('Unable to extract file ID from URL')
    }
  }

  private extractFilenameFromUrl(url: string): string {
    try {
      const urlParts = url.split('/')
      return urlParts[urlParts.length - 1] || 'unknown'
    } catch {
      return 'unknown'
    }
  }
}
