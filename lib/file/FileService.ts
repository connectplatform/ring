import { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata } from './interfaces/IFileService';
import { FileSelector, FileBackendType } from './FileSelector';

class FileServiceManager {
  private selector: FileSelector;
  private cache = new Map<string, IFileService>();

  constructor() {
    this.selector = new FileSelector();
  }

  /**
   * Get file service instance
   */
  getService(backend?: FileBackendType): IFileService {
    // If no backend specified, let FileSelector determine from environment
    const service = this.selector.getService(backend);

    // Cache the service for reuse
    const backendType = backend || (process.env.FILE_BACKEND as FileBackendType) || 'vercel';
    const cacheKey = backendType;

    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, service);
    }

    return service;
  }

  /**
   * Upload a file
   */
  async upload(filename: string, file: File | Buffer, options?: FileUploadOptions, backend?: FileBackendType): Promise<FileUploadResult> {
    const service = this.getService(backend);
    return service.upload(filename, file, options);
  }

  /**
   * Delete a file
   */
  async delete(url: string, backend?: FileBackendType): Promise<FileDeleteResult> {
    const service = this.getService(backend);
    return service.delete(url);
  }

  /**
   * Get file metadata
   */
  async getMetadata(url: string, backend?: FileBackendType): Promise<FileMetadata | null> {
    const service = this.getService(backend);
    return service.getMetadata(url);
  }

  /**
   * Test backend connectivity
   */
  async testBackend(backend: FileBackendType): Promise<boolean> {
    return this.selector.testBackend(backend);
  }

  /**
   * Get available backends
   */
  getAvailableBackends(): FileBackendType[] {
    return this.selector.getAvailableBackends();
  }
}

// Singleton instance
let fileServiceManager: FileServiceManager | null = null;

/**
 * Get file service manager instance
 */
function getFileServiceManager(): FileServiceManager {
  if (!fileServiceManager) {
    fileServiceManager = new FileServiceManager();
  }
  return fileServiceManager;
}

/**
 * File abstraction layer - similar to db() function
 * Provides unified interface for file operations across different backends
 */
export function file(backend?: FileBackendType): IFileService {
  const manager = getFileServiceManager();
  return manager.getService(backend);
}

/**
 * Direct access to file operations with automatic backend selection
 */
export const fileService = {
  /**
   * Upload a file
   */
  upload: (filename: string, file: File | Buffer, options?: FileUploadOptions, backend?: FileBackendType) =>
    getFileServiceManager().upload(filename, file, options, backend),

  /**
   * Delete a file
   */
  delete: (url: string, backend?: FileBackendType) =>
    getFileServiceManager().delete(url, backend),

  /**
   * Get file metadata
   */
  getMetadata: (url: string, backend?: FileBackendType) =>
    getFileServiceManager().getMetadata(url, backend),

  /**
   * Test backend connectivity
   */
  testBackend: (backend: FileBackendType) =>
    getFileServiceManager().testBackend(backend),

  /**
   * Get available backends
   */
  getAvailableBackends: () =>
    getFileServiceManager().getAvailableBackends(),
};

// Export types for external use
export type { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata, FileBackendType };
