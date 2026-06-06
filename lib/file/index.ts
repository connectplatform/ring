// Main file abstraction layer exports
export { file, fileService } from './FileService';
export type { IFileService, FileUploadOptions, FileUploadResult, FileDeleteResult, FileMetadata } from './interfaces/IFileService';
export type { FileBackendType } from './FileSelector';

// Backend adapters (for advanced usage)
export { VercelAdapter } from './adapters/VercelAdapter';
export { RingBaseAdapter } from './adapters/RingBaseAdapter';
export { LocalStorageAdapter } from './adapters/LocalStorageAdapter';

// Backend selector (for advanced usage)
export { FileSelector } from './FileSelector';
export { getStorageBackendFromEnvironment } from './FileSelector';
export { resolveLocalStorageRoot } from './local-storage-root';
export type { ResolveLocalStorageRootOptions } from './local-storage-root';
