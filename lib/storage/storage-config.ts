/**
 * Storage Configuration for Ring Platform
 * 
 * Configurable storage system that supports Vercel Blob and local storage
 * Based on environment configuration
 */

export enum StorageProvider {
  VERCEL_BLOB = 'vercel_blob',
  LOCAL_STORAGE = 'local_storage',
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
  const provider = (process.env.NEXT_PUBLIC_STORAGE_PROVIDER as StorageProvider) || StorageProvider.VERCEL_BLOB;
  
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
      
    default:
      return {
        ...baseConfig,
        provider: StorageProvider.VERCEL_BLOB,
        uploadUrl: '/api/upload/blob',
        publicUrl: process.env.NEXT_PUBLIC_VERCEL_BLOB_URL
      };
  }
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
