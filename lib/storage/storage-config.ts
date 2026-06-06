/**
 * Storage Configuration for Ring Platform
 * 
 * Configurable storage system that supports Vercel Blob and local storage
 * Based on environment configuration
 */

export enum StorageProvider {
  VERCEL_BLOB = 'vercel_blob',
  LOCAL_STORAGE = 'local_storage',
  RING_FILEBASE = 'ring_filebase',
  FIREBASE_STORAGE = 'firebase_storage'
}

export interface StorageConfig {
  provider: StorageProvider;
  uploadUrl: string;
  publicUrl?: string;
  maxFileSize: number;
  allowedTypes: string[];
}

/**
 * Get storage configuration based on environment
 */
export function getStorageConfig(): StorageConfig {
  const provider = getStorageProvider();
  
  const baseConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  switch (provider) {
    case StorageProvider.VERCEL_BLOB:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/blob',
        publicUrl: process.env.NEXT_PUBLIC_VERCEL_BLOB_URL
      };
      
    case StorageProvider.LOCAL_STORAGE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/local',
        publicUrl: process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL || '/uploads'
      };
      
    case StorageProvider.FIREBASE_STORAGE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/firebase',
        publicUrl: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_URL
      };
      
    case StorageProvider.RING_FILEBASE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/ring-filebase',
        publicUrl: process.env.RINGBASE_PUBLIC_URL || process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL
      };

    default:
      return {
        ...baseConfig,
        provider: StorageProvider.VERCEL_BLOB,
        uploadUrl: '/api/upload/blob',
        publicUrl: process.env.NEXT_PUBLIC_VERCEL_BLOB_URL
      };
  }
}

export function normalizeStorageProvider(raw?: string): StorageProvider {
  const value = String(raw || '').trim().toLowerCase()

  switch (value) {
    case 'vercel':
    case StorageProvider.VERCEL_BLOB:
      return StorageProvider.VERCEL_BLOB
    case 'local':
    case StorageProvider.LOCAL_STORAGE:
      return StorageProvider.LOCAL_STORAGE
    case 'ringbase':
    case 'ring_filebase':
    case 'ring-filebase':
      return StorageProvider.RING_FILEBASE
    case 'firebase':
    case StorageProvider.FIREBASE_STORAGE:
      return StorageProvider.FIREBASE_STORAGE
    default:
      return StorageProvider.VERCEL_BLOB
  }
}

export function getStorageProvider(): StorageProvider {
  return normalizeStorageProvider(process.env.NEXT_PUBLIC_STORAGE_PROVIDER)
}

/**
 * Profile-specific storage configuration
 */
export function getProfileStorageConfig(): StorageConfig {
  const config = getStorageConfig();
  return {
    ...config,
    maxFileSize: 2 * 1024 * 1024, // 2MB for profile images
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  };
}

/**
 * KYC document storage configuration
 */
export function getKYCStorageConfig(): StorageConfig {
  const config = getStorageConfig();
  return {
    ...config,
    maxFileSize: 10 * 1024 * 1024, // 10MB for KYC documents
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  };
}

/**
 * Validate file against storage config
 */
export function validateFile(file: File, config: StorageConfig): { valid: boolean; error?: string } {
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${config.maxFileSize / (1024 * 1024)}MB`
    };
  }

  if (!config.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}
