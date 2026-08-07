/**
 * Active NFT gate template pointer — runtime SSOT via db() (nft_gates).
 * ring-config.json stays install defaults; never rewritten in k8s.
 */

import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { NftGateSlug } from './types'

export type ActiveTemplatePointer = {
  id: string
  kind: 'active_template'
  slug: NftGateSlug
  activeTemplateAsset: string
  imageUri?: string
  priceRing?: number
  editionId?: string
  signature?: string
  activatedBy?: string
  activatedAt: string
  updatedAt: string
}

function pointerId(slug: string): string {
  return `nft_active_${slug}`
}

function nowIso() {
  return new Date().toISOString()
}

/** Upsert current sellable template asset for a slug (after successful mint). */
export async function upsertActiveTemplatePointer(params: {
  slug: NftGateSlug
  activeTemplateAsset: string
  imageUri?: string
  priceRing?: number
  editionId?: string
  signature?: string
  activatedBy?: string
}): Promise<{ success: boolean; error?: string }> {
  await initializeDatabase()
  const id = pointerId(params.slug)
  const activatedAt = nowIso()
  const payload: ActiveTemplatePointer = {
    id,
    kind: 'active_template',
    slug: params.slug,
    activeTemplateAsset: params.activeTemplateAsset,
    imageUri: params.imageUri,
    priceRing: params.priceRing,
    editionId: params.editionId,
    signature: params.signature,
    activatedBy: params.activatedBy,
    activatedAt,
    updatedAt: activatedAt,
  }

  const existing = await db().readDoc<ActiveTemplatePointer>('nft_gates', id)
  if (existing.success && existing.data) {
    const updated = await db().updateDoc('nft_gates', id, payload, { merge: true })
    if (!updated.success) {
      const message =
        updated.error instanceof Error ? updated.error.message : 'Failed to update active template pointer'
      logger.error('upsertActiveTemplatePointer: update failed', { slug: params.slug, message })
      return { success: false, error: message }
    }
    return { success: true }
  }

  const created = await db().createDoc('nft_gates', payload, { id })
  if (!created.success) {
    const message =
      created.error instanceof Error ? created.error.message : 'Failed to create active template pointer'
    logger.error('upsertActiveTemplatePointer: create failed', { slug: params.slug, message })
    return { success: false, error: message }
  }
  return { success: true }
}

export async function getActiveTemplatePointer(
  slug: NftGateSlug | string,
): Promise<ActiveTemplatePointer | null> {
  await initializeDatabase()
  const result = await db().readDoc<ActiveTemplatePointer>('nft_gates', pointerId(slug))
  if (!result.success || !result.data) return null
  if (result.data.kind && result.data.kind !== 'active_template') return null
  return result.data
}

/** Map slug → activeTemplateAsset (+ optional imageUri) from db(). */
export async function loadActiveTemplateOverlay(): Promise<
  Record<string, { activeTemplateAsset: string; imageUri?: string }>
> {
  await initializeDatabase()
  const result = await db().queryDocs<ActiveTemplatePointer & Record<string, unknown>>({
    collection: 'nft_gates',
    filters: [{ field: 'kind', operator: '==', value: 'active_template' }],
    pagination: { limit: 50 },
  })
  if (!result.success || !result.data) return {}

  const overlay: Record<string, { activeTemplateAsset: string; imageUri?: string }> = {}
  for (const row of result.data) {
    const slug = typeof row.slug === 'string' ? row.slug : null
    const asset = typeof row.activeTemplateAsset === 'string' ? row.activeTemplateAsset : null
    if (!slug || !asset) continue
    overlay[slug] = {
      activeTemplateAsset: asset,
      ...(typeof row.imageUri === 'string' ? { imageUri: row.imageUri } : {}),
    }
  }
  return overlay
}
