import { put, del, head } from '@vercel/blob';
import { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata } from '../interfaces/IFileService';

export class VercelAdapter implements IFileService {
  async upload(filename: string, file: File | Buffer, options: FileUploadOptions = {}): Promise<FileUploadResult> {
    try {
      const uploadOptions: any = {
        access: options.access || 'public',
      };

      if (options.contentType) {
        uploadOptions.contentType = options.contentType;
      }

      if (options.metadata) {
        uploadOptions.metadata = options.metadata;
      }

      if (options.addRandomSuffix !== false) {
        // Vercel Blob automatically adds random suffix by default
      }

      if (options.cacheControlMaxAge) {
        uploadOptions.cacheControlMaxAge = options.cacheControlMaxAge;
      }

      const blob = await put(filename, file, uploadOptions);

      return {
        success: true,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        filename,
        size: file instanceof File ? file.size : file.length,
        contentType: blob.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('VercelAdapter upload error:', error);
      return {
        success: false,
        url: '',
        filename,
        size: 0,
        contentType: '',
        uploadedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  async delete(url: string): Promise<FileDeleteResult> {
    try {
      await del(url);
      return {
        success: true,
      };
    } catch (error) {
      console.error('VercelAdapter delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      };
    }
  }

  async getMetadata(url: string): Promise<FileMetadata | null> {
    try {
      const metadata = await head(url);

      return {
        filename: this.extractFilenameFromUrl(url),
        size: metadata.size,
        contentType: metadata.contentType,
        uploadedAt: metadata.uploadedAt.toISOString(),
        url,
        downloadUrl: url, // Vercel blob URLs are direct download URLs
      };
    } catch (error) {
      console.error('VercelAdapter getMetadata error:', error);
      return null;
    }
  }

  private extractFilenameFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
