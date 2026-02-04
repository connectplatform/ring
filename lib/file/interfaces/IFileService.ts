export interface FileUploadOptions {
  access?: 'public' | 'private';
  contentType?: string;
  metadata?: Record<string, string>;
  addRandomSuffix?: boolean;
  cacheControlMaxAge?: number;
}

export interface FileUploadResult {
  success: boolean;
  url: string;
  downloadUrl?: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  fileId?: string;
  error?: string;
}

export interface FileDeleteResult {
  success: boolean;
  error?: string;
}

export interface FileMetadata {
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  url: string;
  downloadUrl?: string;
}

export interface IFileService {
  /**
   * Upload a file to storage
   * @param filename - Original filename
   * @param file - File object or buffer
   * @param options - Upload options
   * @returns Promise<FileUploadResult>
   */
  upload(filename: string, file: File | Buffer, options?: FileUploadOptions): Promise<FileUploadResult>;

  /**
   * Delete a file from storage
   * @param url - File URL to delete
   * @returns Promise<FileDeleteResult>
   */
  delete(url: string): Promise<FileDeleteResult>;

  /**
   * Get file metadata
   * @param url - File URL
   * @returns Promise<FileMetadata | null>
   */
  getMetadata(url: string): Promise<FileMetadata | null>;
}
