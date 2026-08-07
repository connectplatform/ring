import { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata } from './interfaces/IFileService';
import { FileSelector, FileBackendType, getStorageBackendFromEnvironment } from './FileSelector';

class FileServiceManager {
  private selector: FileSelector;
  private cache = new Map<string, IFileService>();

  constructor() {
    this.selector = new FileSelector();
  }

  /**
   * Get file service instance (sync — RingFileBase / Vercel only until local is warmed)
   */
  getService(backend?: FileBackendType): IFileService {
    const service = this.selector.getService(backend);
    const backendType = backend || getStorageBackendFromEnvironment();
    if (!this.cache.has(backendType)) {
      this.cache.set(backendType, service);
    }
    return service;
  }

  /** Async getter — required when STORAGE_PROVIDER=local (lazy LocalStorageAdapter). */
  async getServiceAsync(backend?: FileBackendType): Promise<IFileService> {
    const service = await this.selector.getServiceAsync(backend);
    const backendType = backend || getStorageBackendFromEnvironment();
    if (!this.cache.has(backendType)) {
      this.cache.set(backendType, service);
    }
    return service;
  }

  /**
   * Upload a file
   */
  async upload(filename: string, file: File | Buffer, options?: FileUploadOptions, backend?: FileBackendType): Promise<FileUploadResult> {
    const service = await this.getServiceAsync(backend);
    return service.upload(filename, file, options);
  }

  /**
   * Delete a file
   */
  async delete(url: string, backend?: FileBackendType): Promise<FileDeleteResult> {
    const service = await this.getServiceAsync(backend);
    return service.delete(url);
  }

  /**
   * Get file metadata
   */
  async getMetadata(url: string, backend?: FileBackendType): Promise<FileMetadata | null> {
    const service = await this.getServiceAsync(backend);
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
