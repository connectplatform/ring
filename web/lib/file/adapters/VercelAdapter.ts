import { put, del, head } from '@vercel/blob'
import {
  IFileService,
  FileUploadOptions,
  FileUploadResult,
  FileDeleteResult,
  FileMetadata,
} from '../interfaces/IFileService'

/**
 * Vercel Blob adapter.
 *
 * Node 25 / undici 7+: `put(filename, File)` and some Readable streams hit
 * `stream.isDisturbed is not a function`. Always upload a Uint8Array/Blob body.
 */
export class VercelAdapter implements IFileService {
  async upload(
    filename: string,
    file: File | Buffer,
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    try {
      const uploadOptions: Record<string, unknown> = {
        access: options.access || 'public',
      }

      if (options.contentType) {
        uploadOptions.contentType = options.contentType
      }

      if (options.addRandomSuffix !== undefined) {
        uploadOptions.addRandomSuffix = options.addRandomSuffix
      }

      if (options.metadata) {
        uploadOptions.metadata = options.metadata
      }

      if (options.cacheControlMaxAge) {
        uploadOptions.cacheControlMaxAge = options.cacheControlMaxAge
      }

      const bytes =
        file instanceof Buffer
          ? new Uint8Array(file)
          : new Uint8Array(await (file as File).arrayBuffer())

      const contentType =
        options.contentType ||
        (file instanceof File ? file.type : undefined) ||
        'application/octet-stream'

      // Prefer raw bytes — avoids File/stream path that breaks on Node 25 undici.
      // Cast: @vercel/blob PutBody typings lag Uint8Array generics under TS 5.x / Node 25.
      const blob = await put(filename, Buffer.from(bytes), {
        ...uploadOptions,
        contentType,
        access: (options.access || 'public') as 'public',
      })

      return {
        success: true,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        filename,
        size: bytes.byteLength,
        contentType: blob.contentType || contentType,
        uploadedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('VercelAdapter upload error:', error)
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
      await del(url)
      return {
        success: true,
      }
    } catch (error) {
      console.error('VercelAdapter delete error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      }
    }
  }

  async getMetadata(url: string): Promise<FileMetadata | null> {
    try {
      const metadata = await head(url)

      return {
        filename: this.extractFilenameFromUrl(url),
        size: metadata.size,
        contentType: metadata.contentType,
        uploadedAt: metadata.uploadedAt.toISOString(),
        url,
        downloadUrl: url,
      }
    } catch (error) {
      console.error('VercelAdapter getMetadata error:', error)
      return null
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
