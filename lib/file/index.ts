// Main file abstraction layer exports
export { file, fileService } from './FileService';
export type {
  IFileService,
  FileUploadOptions,
  FileUploadResult,
  FileDeleteResult,
  FileMetadata,
  MediaDerivatives,
} from './interfaces/IFileService'
export type { FileBackendType } from './FileSelector'
export type { MediaImageAsset, MediaImageSlot } from './media-asset'
export {
  coerceMediaImageAsset,
  coerceMediaImageAssetList,
  pickImageSrc,
  featuredImageUrl,
  webpAliasFromDerivatives,
} from './media-asset'
export {
  shouldRequestDerivatives,
  resolveDerivativesProfileForPurpose,
  resolveRingbaseTypeForPurpose,
  ringbaseDerivativeUploadOptions,
} from './derivatives-profile'

// Backend adapters (for advanced usage)
export { VercelAdapter } from './adapters/VercelAdapter';
export { RingBaseAdapter } from './adapters/RingBaseAdapter';
export { LocalStorageAdapter } from './adapters/LocalStorageAdapter';

// Backend selector (for advanced usage)
export { FileSelector } from './FileSelector';
export { getStorageBackendFromEnvironment } from './FileSelector';
export { resolveLocalStorageRoot } from './local-storage-root';
export type { ResolveLocalStorageRootOptions } from './local-storage-root';
