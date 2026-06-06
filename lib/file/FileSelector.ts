import { IFileService } from './interfaces/IFileService';
import { VercelAdapter } from './adapters/VercelAdapter';
import { RingBaseAdapter } from './adapters/RingBaseAdapter';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { StorageProvider, getStorageProvider } from '../storage/storage-config';

export type FileBackendType = StorageProvider.VERCEL_BLOB | StorageProvider.RING_FILEBASE | StorageProvider.LOCAL_STORAGE;

export interface FileBackendConfig {
  type: FileBackendType;
  apiUrl?: string;
  apiToken?: string;
}

export class FileSelector {
  private backends = new Map<FileBackendType, IFileService>();
  private defaultBackend: FileBackendType;

  constructor(defaultBackend: FileBackendType = StorageProvider.VERCEL_BLOB) {
    this.defaultBackend = defaultBackend;
    this.initializeBackends();
  }

  private initializeBackends(): void {
    this.backends.set(StorageProvider.VERCEL_BLOB, new VercelAdapter());
    this.backends.set(StorageProvider.LOCAL_STORAGE, new LocalStorageAdapter());

    // Initialize RingBase adapter for ring_filebase selector
    const ringbaseApiUrl = process.env.RINGBASE_API_URL;
    const ringbaseApiToken = process.env.RINGBASE_API_TOKEN;
    this.backends.set(StorageProvider.RING_FILEBASE, new RingBaseAdapter(ringbaseApiUrl, ringbaseApiToken));
  }

  /**
   * Get file service for specified backend
   */
  getService(backend?: FileBackendType): IFileService {
    const backendType = backend || getStorageBackendFromEnvironment();
    const service = this.backends.get(backendType);

    if (!service) {
      throw new Error(`File backend '${backendType}' not available`);
    }

    return service;
  }

  /**
   * Get backend type from environment variables
   */
  getBackendFromEnvironment(): FileBackendType {
    return getStorageBackendFromEnvironment();
  }

  /**
   * Test backend connectivity
   */
  async testBackend(backend: FileBackendType): Promise<boolean> {
    try {
      const service = this.getService(backend);
      // Simple test - try to get metadata for a non-existent file
      await service.getMetadata('https://example.com/test');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all available backends
   */
  getAvailableBackends(): FileBackendType[] {
    return Array.from(this.backends.keys());
  }
}

export function getStorageBackendFromEnvironment(): FileBackendType {
  const provider = getStorageProvider();

  if (!Object.values(StorageProvider).includes(provider as StorageProvider)) {
    return StorageProvider.VERCEL_BLOB;
  }

  // LocalStorageSelector intentionally ignores firebase path until first-party support is implemented.
  if (provider === StorageProvider.FIREBASE_STORAGE) {
    return StorageProvider.LOCAL_STORAGE;
  }

  return provider as FileBackendType;
}
