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
// Prefer RingBase / Vercel via file(). Local disk adapter is NOT re-exported here
// so Turbopack NFT does not pull process.cwd() into every route that imports
// `@/lib/file`. Deep-import when needed:
//   import { LocalStorageAdapter } from '@/lib/file/adapters/LocalStorageAdapter'
//   import { resolveLocalStorageRoot } from '@/lib/file/local-storage-root'
export { VercelAdapter } from './adapters/VercelAdapter';
export { RingBaseAdapter } from './adapters/RingBaseAdapter';

// Backend selector (for advanced usage)
export { FileSelector } from './FileSelector';
export { getStorageBackendFromEnvironment } from './FileSelector';
