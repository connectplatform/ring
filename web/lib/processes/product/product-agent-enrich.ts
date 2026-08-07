/**
 * Nightly product-agent enrich — WebConductor research for stale/missing productAgent.
 * Cap batch size to bound OpenRouter spend. Auth-free (cron / ProcessConductor).
 */

import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import { flattenProductDocumentForWrite } from '@/features/store/lib/product-document'
import { runProductAgentResearch } from '@/features/store/lib/product-agent-research'

const DEFAULT_LIMIT = 5
const STALE_MS = 7 * 24 * 60 * 60 * 1000

function productUrlOf(row: Record<string, unknown>): string {
  return String(
    row.productUrl ||
      row.product_url ||
      (row.data as { productUrl?: string } | undefined)?.productUrl ||
      '',
  ).trim()
}

function researchedAtMs(row: Record<string, unknown>): number | null {
  const raw =
    row.productAgentResearchedAt ||
    row.product_agent_researched_at ||
    (row.data as { productAgentResearchedAt?: string } | undefined)?.productAgentResearchedAt
  if (!raw) return null
  const t = Date.parse(String(raw))
  return Number.isFinite(t) ? t : null
}

function needsEnrich(row: Record<string, unknown>, now: number): boolean {
  const url = productUrlOf(row)
  if (!/^https?:\/\//i.test(url)) return false
  const agent = String(row.productAgent || '').trim()
  if (!agent) return true
  const at = researchedAtMs(row)
  if (at == null) return true
  return now - at >= STALE_MS
}

export async function runProductAgentEnrich(limit = DEFAULT_LIMIT): Promise<{
  success: boolean
  scanned: number
  enriched: number
  failed: number
  skipped: number
  productIds: string[]
  errors: Array<{ productId: string; error: string }>
}> {
  await initializeDatabase()
  const now = Date.now()
  const errors: Array<{ productId: string; error: string }> = []
  const productIds: string[] = []

  const listed = await db().queryDocs<Record<string, unknown>>({
    collection: 'store_products',
    filters: [{ field: 'approvalStatus', operator: '==', value: 'approved' }],
    pagination: { limit: Math.max(limit * 8, 40), offset: 0 },
  })

  if (!listed.success || !listed.data) {
    throw listed.error || new Error('Failed to query store_products')
  }

  const candidates = listed.data.filter((row) => needsEnrich(row, now)).slice(0, limit)
  let enriched = 0
  let failed = 0

  for (const row of candidates) {
    const productId = String(row.id || '')
    const productUrl = productUrlOf(row)
    if (!productId || !productUrl) {
      failed += 1
      continue
    }
    try {
      const research = await runProductAgentResearch({
        product: {
          id: productId,
          name: String(row.name || 'Product'),
          category: String(row.category || 'General'),
          description: row.description ? String(row.description) : undefined,
          sku: row.sku ? String(row.sku) : undefined,
        },
        productUrl,
      })
      const patch = flattenProductDocumentForWrite(row, {
        productAgent: research.productAgentMarkdown,
        productAgentResearchedAt: new Date().toISOString(),
        productAgentCitations: research.citations.slice(0, 20),
      })
      const update = await db().updateDoc('store_products', productId, patch)
      if (!update.success) {
        failed += 1
        errors.push({
          productId,
          error: update.error?.message || 'update failed',
        })
        continue
      }
      enriched += 1
      productIds.push(productId)
    } catch (err) {
      failed += 1
      errors.push({
        productId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    success: true,
    scanned: listed.data.length,
    enriched,
    failed,
    skipped: Math.max(0, listed.data.length - candidates.length),
    productIds,
    errors,
  }
}
