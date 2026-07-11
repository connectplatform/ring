import {
  IFileService,
  FileUploadOptions,
  FileUploadResult,
  FileDeleteResult,
  FileMetadata,
} from '../interfaces/IFileService'

/**
 * RingFileBase CDN adapter — self-hosted Ceph/RGW via ring-filebase-api.
 *
 * Base URL normalization: RINGBASE_API_URL may be host-only or already include `/api/v1`.
 * Endpoints are always `{base}/upload`, `{base}/files/:id` (no double `/api/v1`).
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

  async upload(
    filename: string,
    file: File | Buffer,
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    try {
      const formData = new FormData()

      // Always append a Blob (never a File / Readable stream).
      // Node 25 / undici 7+: File and some streams hit
      // `stream.isDisturbed is not a function` when FormData is serialized.
      // Blob + filename (3rd arg) still emits a valid multipart filename header.
      const contentType =
        options.contentType ||
        (file instanceof File ? file.type : undefined) ||
        'application/octet-stream'
      const bytes =
        file instanceof Buffer
          ? new Uint8Array(file)
          : new Uint8Array(await (file as File).arrayBuffer())
      const fileToUpload = new Blob([bytes], { type: contentType })

      formData.append('file', fileToUpload, filename)
      // ring-filebase-api validation: `media` is A/V(+HEIC) only; images use `product`.
      // Private blobs use `document`. Unknown/binary falls back to `other` (*/*).
      const uploadType =
        options.access === 'private'
          ? 'document'
          : contentType.startsWith('image/')
            ? 'product'
            : contentType.startsWith('video/') || contentType.startsWith('audio/')
              ? 'media'
              : 'other'
      formData.append('type', uploadType)

      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata))
      }

      const headers: Record<string, string> = {}

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const response = await fetch(this.endpoint('/upload'), {
        method: 'POST',
        headers,
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

  async delete(url: string): Promise<FileDeleteResult> {
    try {
      const fileId = this.extractFileIdFromUrl(url)

      const headers: Record<string, string> = {}

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const response = await fetch(this.endpoint(`/files/${fileId}`), {
        method: 'DELETE',
        headers,
      })

      if (!response.ok) {
        throw new Error(`RingBase delete failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: result.success,
        error: result.error,
      }
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

      const headers: Record<string, string> = {}

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const response = await fetch(this.endpoint(`/files/${fileId}/metadata`), {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        return null
      }

      const result = await response.json()

      if (!result.success || !result.file) {
        return null
      }

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

      if (filesIndex !== -1 && filesIndex < urlParts.length - 1) {
        return urlParts[urlParts.length - 1]
      }

      return urlParts[urlParts.length - 1]
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
