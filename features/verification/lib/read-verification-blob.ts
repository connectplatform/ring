import 'server-only'

import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { resolveLocalStorageRoot } from '@/lib/file/local-storage-root'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function readVerificationBlob(objectKey: string): Promise<{
  buffer: Buffer
  contentType: string
}> {
  const root = resolveLocalStorageRoot()
  const safeKey = objectKey.replace(/\.\./g, '').replace(/^\/+/, '')
  const fullPath = join(root, safeKey)
  const buffer = await readFile(fullPath)
  const ext = extname(safeKey).toLowerCase()
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream'
  return { buffer, contentType }
}
