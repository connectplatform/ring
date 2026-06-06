import { writeFile, mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { resolveLocalStorageRoot } from '../local-storage-root';
import { FileMetadata, FileUploadOptions, FileUploadResult, FileDeleteResult, IFileService } from '../interfaces/IFileService';

export class LocalStorageAdapter implements IFileService {
  private readonly storageDir: string;
  private readonly publicUrlPrefix: string;

  constructor(storageDir?: string, publicUrlPrefix?: string) {
    this.storageDir = resolveLocalStorageRoot(
      storageDir != null && storageDir !== ''
        ? { configuredDir: storageDir }
        : undefined
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL;
    const localPrefix = normalizeUrlPrefix(publicUrlPrefix || process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL || '/uploads');
    this.publicUrlPrefix = baseUrl ? `${baseUrl.replace(/\/$/, '')}${localPrefix}` : localPrefix;
  }

  async upload(filename: string, file: File | Buffer, options: FileUploadOptions = {}): Promise<FileUploadResult> {
    try {
      const content = file instanceof Buffer
        ? file
        : Buffer.from(await (file as File).arrayBuffer());
      const safeName = sanitizeStoragePath(filename);
      const fullPath = join(this.storageDir, safeName);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);

      const url = `${this.publicUrlPrefix}/${safeName}`;

      return {
        success: true,
        url,
        downloadUrl: url,
        filename,
        size: content.byteLength,
        contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LocalStorageAdapter upload error:', error);
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
      const filePath = this.resolvePath(url);
      await unlink(filePath);
      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          success: true,
        };
      }

      console.error('LocalStorageAdapter delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      };
    }
  }

  async getMetadata(url: string): Promise<FileMetadata | null> {
    try {
      const filePath = this.resolvePath(url);
      const stats = await stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        filename: fileNameFromPath(url),
        size: stats.size,
        contentType: 'application/octet-stream',
        uploadedAt: stats.mtime.toISOString(),
        url,
        downloadUrl: url,
      };
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      console.error('LocalStorageAdapter getMetadata error:', error);
      return null;
    }
  }

  private resolvePath(url: string): string {
    const direct = sanitizeStoragePath(toRelativePath(url, this.publicUrlPrefix));
    const fullPath = resolve(join(this.storageDir, direct));
    const basePath = resolve(this.storageDir);

    if (!fullPath.startsWith(basePath + '/')) {
      throw new Error('Invalid storage key');
    }

    return fullPath;
  }
}

function normalizeUrlPrefix(prefix: string): string {
  return (prefix || '/uploads').trim().replace(/\/+$/, '') || '/uploads';
}

function toRelativePath(url: string, publicUrlPrefix: string): string {
  if (!url) {
    throw new Error('Invalid storage URL');
  }

  let path = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      path = new URL(url).pathname;
    } catch {
      throw new Error('Invalid storage URL');
    }
  }

  const normalizedPrefix = normalizeUrlPrefix(publicUrlPrefix);
  if (path.startsWith(normalizedPrefix)) {
    path = path.slice(normalizedPrefix.length);
  }

  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  return path;
}

function sanitizeStoragePath(value: string): string {
  const normalized = normalize(value).replace(/\\/g, '/');
  const parts = normalized
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_'));

  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid storage filename');
  }

  return join(...parts);
}

function fileNameFromPath(path: string): string {
  return path.split('?')[0].split('/').pop() || 'unknown';
}
