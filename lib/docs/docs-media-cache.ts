import 'server-only'

import { createHash } from 'crypto'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export type DocsMediaCacheKind = 'narration' | 'walkthrough'

export type DocsMediaCacheRecord = {
  id: string
  kind: DocsMediaCacheKind
  locale: string
  slug: string
  contentHash: string
  audioUrl?: string
  videoUrl?: string
  summary?: string
  created_at: string
  updated_at: string
}

export function hashDocsContent(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24)
}

function cacheId(kind: DocsMediaCacheKind, locale: string, slug: string[], contentHash: string): string {
  const slugKey = slug.join('/') || 'index'
  return `docs-media-${kind}-${locale}-${hashDocsContent(`${slugKey}:${contentHash}`)}`.slice(0, 200)
}

/** Lookup cached docs media by content hash (SSOT — regenerate only when MDX changes). */
export async function findDocsMediaCache(input: {
  kind: DocsMediaCacheKind
  locale: string
  slug: string[]
  contentHash: string
}): Promise<DocsMediaCacheRecord | null> {
  const id = cacheId(input.kind, input.locale, input.slug, input.contentHash)
  try {
    const found = await db().findDocById<DocsMediaCacheRecord>('generated_docs_media', id)
    if (found.success && found.data) {
      return { ...found.data, id }
    }
  } catch (e) {
    logger.warn('[docs-media-cache] lookup failed', { id, error: e })
  }
  return null
}

export async function saveDocsMediaCache(input: {
  kind: DocsMediaCacheKind
  locale: string
  slug: string[]
  contentHash: string
  audioUrl?: string
  videoUrl?: string
  summary?: string
}): Promise<void> {
  const id = cacheId(input.kind, input.locale, input.slug, input.contentHash)
  const now = new Date().toISOString()
  const record: DocsMediaCacheRecord = {
    id,
    kind: input.kind,
    locale: input.locale,
    slug: input.slug.join('/'),
    contentHash: input.contentHash,
    audioUrl: input.audioUrl,
    videoUrl: input.videoUrl,
    summary: input.summary,
    created_at: now,
    updated_at: now,
  }
  try {
    const existing = await db().findDocById('generated_docs_media', id)
    if (existing.success && existing.data) {
      await db().updateDoc('generated_docs_media', id, {
        ...record,
        created_at: (existing.data as DocsMediaCacheRecord).created_at ?? now,
      })
      return
    }
    const created = await db().createDoc('generated_docs_media', record, { id })
    if (!created.success) {
      logger.warn('[docs-media-cache] create failed', { id, error: created.error })
    }
  } catch (e) {
    logger.warn('[docs-media-cache] save failed', { id, error: e })
  }
}
