/**
 * Storage Configuration for Ring Platform
 *
 * SSOT resolution (mirrors db() BackendSelector pattern):
 *   1. NEXT_PUBLIC_STORAGE_PROVIDER / STORAGE_PROVIDER env (deployment override)
 *   2. ring-config.json `storage.provider`
 *   3. Default: ring_filebase (RingFileBase / CDN write path)
 *
 * Backends: ring_filebase | vercel_blob | local_storage | firebase_storage
 */

import { cache } from 'react'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

export enum StorageProvider {
  VERCEL_BLOB = 'vercel_blob',
  LOCAL_STORAGE = 'local_storage',
  RING_FILEBASE = 'ring_filebase',
  FIREBASE_STORAGE = 'firebase_storage',
}

export interface StorageConfig {
  provider: StorageProvider
  uploadUrl: string
  publicUrl?: string
  maxFileSize: number
  allowedTypes: string[]
}

/**
 * Get storage configuration based on resolved provider
 */
export function getStorageConfig(): StorageConfig {
  const provider = getStorageProvider()

  const baseConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  }

  switch (provider) {
    case StorageProvider.VERCEL_BLOB:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/blob',
        publicUrl: process.env.NEXT_PUBLIC_VERCEL_BLOB_URL,
      }

    case StorageProvider.LOCAL_STORAGE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/local',
        publicUrl: process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL || '/uploads',
      }

    case StorageProvider.FIREBASE_STORAGE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/firebase',
        publicUrl: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_URL,
      }

    case StorageProvider.RING_FILEBASE:
      return {
        ...baseConfig,
        provider,
        uploadUrl: '/api/upload/ring-filebase',
        publicUrl: process.env.RINGBASE_PUBLIC_URL || process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL,
      }

    default:
      return {
        ...baseConfig,
        provider: StorageProvider.RING_FILEBASE,
        uploadUrl: '/api/upload/ring-filebase',
        publicUrl: process.env.RINGBASE_PUBLIC_URL || process.env.NEXT_PUBLIC_LOCAL_STORAGE_URL,
      }
  }
}

export function normalizeStorageProvider(raw?: string | null): StorageProvider | null {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
  if (!value) return null

  switch (value) {
    case 'vercel':
    case 'vercel_blob':
    case 'vercel-blob':
      return StorageProvider.VERCEL_BLOB
    case 'local':
    case 'local_storage':
    case 'local-storage':
      return StorageProvider.LOCAL_STORAGE
    case 'ringbase':
    case 'ring_filebase':
    case 'ring-filebase':
    case 'filebase':
      return StorageProvider.RING_FILEBASE
    case 'firebase':
    case 'firebase_storage':
    case 'firebase-storage':
      return StorageProvider.FIREBASE_STORAGE
    default:
      return null
  }
}

function readRingConfigStorageProvider(): string | undefined {
  try {
    const snap = getSystemConfigSnapshot() as {
      storage?: { provider?: string; file?: string; object?: string }
    }
    const storage = snap.storage
    if (!storage || typeof storage !== 'object') return undefined
    // Prefer explicit provider; fall back to legacy storage.file / storage.object strings
    return storage.provider || storage.file || storage.object
  } catch {
    return undefined
  }
}

/**
 * Resolve storage provider — env override → ring-config → ring_filebase.
 * Cached per-request (React cache) like other ring-config accessors.
 */
export const getStorageProvider = cache((): StorageProvider => {
  const envRaw =
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER || process.env.STORAGE_PROVIDER
  const fromEnv = normalizeStorageProvider(envRaw)
  if (fromEnv) return fromEnv

  const fromConfig = normalizeStorageProvider(readRingConfigStorageProvider())
  if (fromConfig) return fromConfig

  // Platform default: RingFileBase (public write API / in-cluster API + CDN)
  return StorageProvider.RING_FILEBASE
})

/**
 * Profile-specific storage configuration
 */
export function getProfileStorageConfig(): StorageConfig {
  const config = getStorageConfig()
  return {
    ...config,
    maxFileSize: 2 * 1024 * 1024, // 2MB for profile images
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  }
}

/**
 * KYC document storage configuration
 */
export function getKYCStorageConfig(): StorageConfig {
  const config = getStorageConfig()
  return {
    ...config,
    maxFileSize: 10 * 1024 * 1024, // 10MB for KYC documents
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  }
}

/**
 * Personal File Cabinet storage — docs + images + zip/text (25MB).
 */
export function getCabinetStorageConfig(): StorageConfig {
  const config = getStorageConfig()
  return {
    ...config,
    maxFileSize: 25 * 1024 * 1024,
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/zip',
      'application/x-zip-compressed',
      'video/mp4',
      'video/webm',
    ],
  }
}

/**
 * Validate file against storage config
 */
export function validateFile(
  file: File,
  config: StorageConfig,
): { valid: boolean; error?: string } {
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${config.maxFileSize / (1024 * 1024)}MB`,
    }
  }

  if (!config.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`,
    }
  }

  return { valid: true }
}
