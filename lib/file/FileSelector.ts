import { IFileService } from './interfaces/IFileService';
import { VercelAdapter } from './adapters/VercelAdapter';
import { RingBaseAdapter } from './adapters/RingBaseAdapter';

export type FileBackendType = 'vercel' | 'ringbase';

export interface FileBackendConfig {
  type: FileBackendType;
  apiUrl?: string;
  apiToken?: string;
}

export class FileSelector {
  private backends = new Map<FileBackendType, IFileService>();
  private defaultBackend: FileBackendType;

  constructor(defaultBackend: FileBackendType = 'vercel') {
    this.defaultBackend = defaultBackend;
    this.initializeBackends();
  }

  private initializeBackends(): void {
    // Initialize Vercel adapter
    this.backends.set('vercel', new VercelAdapter());

    // Initialize RingBase adapter
    const ringbaseApiUrl = process.env.RINGBASE_API_URL;
    const ringbaseApiToken = process.env.RINGBASE_API_TOKEN;
    this.backends.set('ringbase', new RingBaseAdapter(ringbaseApiUrl, ringbaseApiToken));
  }

  /**
   * Get file service for specified backend
   */
  getService(backend?: FileBackendType): IFileService {
    const backendType = backend || this.getBackendFromEnvironment();
    const service = this.backends.get(backendType);

    if (!service) {
      throw new Error(`File backend '${backendType}' not available`);
    }

    return service;
  }

  /**
   * Get backend type from environment variables
   */
  private getBackendFromEnvironment(): FileBackendType {
    const backend = process.env.FILE_BACKEND || process.env.NEXT_PUBLIC_FILE_BACKEND;

    if (backend === 'ringbase') {
      return 'ringbase';
    }

    // Default to vercel for backward compatibility
    return 'vercel';
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
