import { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata } from '../interfaces/IFileService';

export class RingBaseAdapter implements IFileService {
  private apiUrl: string;
  private apiToken?: string;

  constructor(apiUrl?: string, apiToken?: string) {
    this.apiUrl = apiUrl || 'http://ring-filebase-api.ring-filebase.svc.cluster.local';
    this.apiToken = apiToken || process.env.RINGBASE_API_TOKEN;
  }

  async upload(filename: string, file: File | Buffer, options: FileUploadOptions = {}): Promise<FileUploadResult> {
    try {
      const formData = new FormData();

      // Convert Buffer to File if needed
      const fileToUpload: File = file instanceof Buffer
        ? new File([new Uint8Array(file)], filename, {
          type: options.contentType || 'application/octet-stream'
          })
        : file as File;

      formData.append('file', fileToUpload);
      formData.append('type', options.access === 'private' ? 'document' : 'media');

      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }

      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const response = await fetch(`${this.apiUrl}/api/v1/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`RingBase upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      return {
        success: true,
        url: result.url,
        downloadUrl: result.url, // RingBase URLs are direct download URLs
        filename,
        size: result.metadata?.size || fileToUpload.size,
        contentType: result.metadata?.mimeType || fileToUpload.type,
        uploadedAt: new Date().toISOString(),
        fileId: result.fileId,
      };
    } catch (error) {
      console.error('RingBaseAdapter upload error:', error);
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
      // Extract file ID from URL
      const fileId = this.extractFileIdFromUrl(url);

      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const response = await fetch(`${this.apiUrl}/api/v1/files/${fileId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`RingBase delete failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error('RingBaseAdapter delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      };
    }
  }

  async getMetadata(url: string): Promise<FileMetadata | null> {
    try {
      const fileId = this.extractFileIdFromUrl(url);

      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const response = await fetch(`${this.apiUrl}/api/v1/files/${fileId}/metadata`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();

      if (!result.success || !result.file) {
        return null;
      }

      const file = result.file;

      return {
        filename: file.filename || this.extractFilenameFromUrl(url),
        size: file.size,
        contentType: file.contentType || file.mimeType,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        url,
        downloadUrl: url,
      };
    } catch (error) {
      console.error('RingBaseAdapter getMetadata error:', error);
      return null;
    }
  }

  private extractFileIdFromUrl(url: string): string {
    try {
      // RingBase URLs follow pattern: https://cdn.ring-platform.org/files/.../fileId
      const urlParts = url.split('/');
      const filesIndex = urlParts.indexOf('files');

      if (filesIndex !== -1 && filesIndex < urlParts.length - 1) {
        return urlParts[urlParts.length - 1];
      }

      // Fallback: assume the last part is the file ID
      return urlParts[urlParts.length - 1];
    } catch {
      throw new Error('Unable to extract file ID from URL');
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
