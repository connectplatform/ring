import { IFileService } from './interfaces/IFileService';
import { VercelAdapter } from './adapters/VercelAdapter';
import { RingBaseAdapter } from './adapters/RingBaseAdapter';
import { StorageProvider, getStorageProvider } from '../storage/storage-config';

export type FileBackendType =
  | StorageProvider.VERCEL_BLOB
  | StorageProvider.RING_FILEBASE
  | StorageProvider.LOCAL_STORAGE;

export interface FileBackendConfig {
  type: FileBackendType;
  apiUrl?: string;
  apiToken?: string;
}

/**
 * Selects a file() backend.
 *
 * LocalStorageAdapter is loaded only via dynamic `import()` when the active
 * provider is LOCAL_STORAGE — keeps `process.cwd()` / fs out of the eager graph
 * for RingFileBase / Vercel production routes. Deep-import local helpers only when needed:
 *   import { LocalStorageAdapter } from '@/lib/file/adapters/LocalStorageAdapter'
 *   import { resolveLocalStorageRoot } from '@/lib/file/local-storage-root'
 */
export class FileSelector {
  private backends = new Map<FileBackendType, IFileService>();
  private defaultBackend: FileBackendType;
  private localAdapterPromise: Promise<IFileService> | null = null;

  constructor(defaultBackend: FileBackendType = StorageProvider.RING_FILEBASE) {
    this.defaultBackend = defaultBackend;
    this.initializeBackends();
  }

  private initializeBackends(): void {
    this.backends.set(StorageProvider.VERCEL_BLOB, new VercelAdapter());

    const ringbaseApiUrl = process.env.RINGBASE_API_URL;
    const ringbaseApiToken = process.env.RINGBASE_API_TOKEN;
    this.backends.set(
      StorageProvider.RING_FILEBASE,
      new RingBaseAdapter(ringbaseApiUrl, ringbaseApiToken),
    );
  }

  private ensureLocalAdapter(): Promise<IFileService> {
    const existing = this.backends.get(StorageProvider.LOCAL_STORAGE);
    if (existing) return Promise.resolve(existing);

    if (!this.localAdapterPromise) {
      this.localAdapterPromise = import('./adapters/LocalStorageAdapter').then(
        ({ LocalStorageAdapter }) => {
          const adapter = new LocalStorageAdapter();
          this.backends.set(StorageProvider.LOCAL_STORAGE, adapter);
          return adapter;
        },
      );
    }
    return this.localAdapterPromise;
  }

  /**
   * Sync getter for Vercel / RingFileBase. For LOCAL_STORAGE use
   * {@link getServiceAsync} (or FileService upload/delete which await it).
   */
  getService(backend?: FileBackendType): IFileService {
    const backendType = backend || getStorageBackendFromEnvironment();

    if (backendType === StorageProvider.LOCAL_STORAGE) {
      const cached = this.backends.get(StorageProvider.LOCAL_STORAGE);
      if (cached) return cached;
      throw new Error(
        'LOCAL_STORAGE backend is not ready yet — use getServiceAsync() or file() async APIs',
      );
    }

    const service = this.backends.get(backendType);
    if (!service) {
      throw new Error(`File backend '${backendType}' is not available`);
    }
    return service;
  }

  async getServiceAsync(backend?: FileBackendType): Promise<IFileService> {
    const backendType = backend || getStorageBackendFromEnvironment();
    if (backendType === StorageProvider.LOCAL_STORAGE) {
      return this.ensureLocalAdapter();
    }
    return this.getService(backendType);
  }

  getBackendFromEnvironment(): FileBackendType {
    return getStorageBackendFromEnvironment();
  }

  async testBackend(backend: FileBackendType): Promise<boolean> {
    try {
      const service = await this.getServiceAsync(backend);
      await service.getMetadata('https://example.com/test');
      return true;
    } catch {
      return false;
    }
  }

  getAvailableBackends(): FileBackendType[] {
    return [
      StorageProvider.VERCEL_BLOB,
      StorageProvider.RING_FILEBASE,
      StorageProvider.LOCAL_STORAGE,
    ];
  }
}

export function getStorageBackendFromEnvironment(): FileBackendType {
  const provider = getStorageProvider();

  if (!Object.values(StorageProvider).includes(provider as StorageProvider)) {
    return StorageProvider.RING_FILEBASE;
  }

  if (provider === StorageProvider.FIREBASE_STORAGE) {
    return StorageProvider.RING_FILEBASE;
  }

  return provider as FileBackendType;
}
