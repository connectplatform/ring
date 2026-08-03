/**
 * DAGI ERP tools — session-bound + hasFeatureForVendor.
 * Never use ring-mcp Bearer SUPERADMIN on the chat path.
 * Model-supplied uid / foreign vendorEntityId are stripped.
 */

import 'server-only'

import { hasFeatureForVendor } from '@/features/nft-gates/gate-resolver'
import { getVendorEntities } from '@/features/entities/services/vendor-entity'
import { stripModelUidArgs } from '@/features/store/services/product-commerce-tools'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { researchProductAgentAction } from '@/app/_actions/product-agent-research'
import {
  flattenProductDocumentForWrite,
  resolveVendorEntityId,
} from '@/features/store/lib/product-document'
import { db } from '@/lib/database'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

/** Anthropic tool schemas — no uid / no foreign vendorEntityId fields. */
export const DAGI_ERP_TOOLS: Tool[] = [
  {
    name: 'dagi_product_get',
    description: 'Get one product in the bound vendor store by productId.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Store product id' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'dagi_stock_read',
    description: 'Read stock / inStock for a product in the bound vendor store.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'dagi_orders_list',
    description: 'List recent orders for the bound vendor store.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max orders (1-20)' },
      },
    },
  },
  {
    name: 'dagi_product_update_fields',
    description:
      'Update allowed product fields (name, description, productAgent markdown) in the bound store.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        productAgent: { type: 'string', description: 'Product agent markdown knowledge' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'dagi_research_product',
    description:
      'WebConductor research: update productAgent + wiki NODUS, suggest CRM fields, download citation-backed images into vendor File Cabinet store/product/alt.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        productUrl: { type: 'string' },
        customPrompt: { type: 'string' },
      },
      required: ['productId', 'productUrl'],
    },
  },
]

/** Require product to belong to bound vendor — empty owner is deny (no IDOR). */
function assertProductInVendorScope(
  doc: Record<string, unknown>,
  vendorEntityId: string,
): string | null {
  const owner = resolveVendorEntityId(doc)
  if (!owner || owner !== vendorEntityId) {
    return 'Product not in bound vendor scope'
  }
  return null
}

export const DAGI_ERP_TOOL_NAMES = [
  'dagi_product_get',
  'dagi_product_update_fields',
  'dagi_stock_read',
  'dagi_orders_list',
  'dagi_research_product',
] as const

export type DagiErpToolName = (typeof DAGI_ERP_TOOL_NAMES)[number]

export type DagiErpToolResult = {
  ok: boolean
  tool: string
  error?: string
  data?: Record<string, unknown>
}

async function assertDagiScope(sessionUserId: string, vendorEntityId: string): Promise<string | null> {
  const entityId = String(vendorEntityId || '').trim()
  if (!sessionUserId || !entityId) return 'Unauthorized'

  const owned = await getVendorEntities(sessionUserId)
  if (!owned.some((e) => e.id === entityId)) {
    return 'vendorEntityId not owned by session user'
  }

  const unlocked = await hasFeatureForVendor(sessionUserId, entityId, 'vendor.dagi')
  if (!unlocked) {
    return 'DAGI not unlocked for this vendorEntityId (stake vendor-dagi-key bound to this store)'
  }

  return null
}

/** Public alias for API / agent service gate checks. */
export async function assertDagiScopePublic(
  sessionUserId: string,
  vendorEntityId: string,
): Promise<string | null> {
  return assertDagiScope(sessionUserId, vendorEntityId)
}

/**
 * Run one DAGI ERP tool. Bound vendorEntityId comes from server context, not the model.
 */
export async function runDagiTool(input: {
  sessionUserId: string
  vendorEntityId: string
  tool: string
  args?: Record<string, unknown>
}): Promise<DagiErpToolResult> {
  const args = stripModelUidArgs(input.args || {})
  // Ignore model attempts to switch vendor scope
  if (args.vendorEntityId && String(args.vendorEntityId) !== input.vendorEntityId) {
    console.warn('[runDagiTool] stripped foreign vendorEntityId from model args')
  }
  delete args.vendorEntityId

  const scopeError = await assertDagiScope(input.sessionUserId, input.vendorEntityId)
  if (scopeError) {
    return { ok: false, tool: input.tool, error: scopeError }
  }

  const vendorEntityId = input.vendorEntityId
  const tool = String(input.tool || '').trim()
  const adapter = new PostgreSQLStoreAdapter()

  try {
    if (tool === 'dagi_product_get') {
      const productId = String(args.productId || '').trim()
      if (!productId) return { ok: false, tool, error: 'productId required' }
      const product = await adapter.getProductById(productId)
      if (!product) return { ok: false, tool, error: 'Product not found' }
      const scopeErr = assertProductInVendorScope(
        product as unknown as Record<string, unknown>,
        vendorEntityId,
      )
      if (scopeErr) return { ok: false, tool, error: scopeErr }
      return {
        ok: true,
        tool,
        data: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: (product as { stock?: number }).stock,
          productAgent: product.productAgent ? '[present]' : null,
        },
      }
    }

    if (tool === 'dagi_stock_read') {
      const productId = String(args.productId || '').trim()
      if (!productId) return { ok: false, tool, error: 'productId required' }
      const product = await adapter.getProductById(productId)
      if (!product) return { ok: false, tool, error: 'Product not found' }
      const scopeErr = assertProductInVendorScope(
        product as unknown as Record<string, unknown>,
        vendorEntityId,
      )
      if (scopeErr) return { ok: false, tool, error: scopeErr }
      return {
        ok: true,
        tool,
        data: {
          productId,
          stock: (product as { stock?: number; stock_quantity?: number }).stock ??
            (product as { stock_quantity?: number }).stock_quantity,
          inStock: product.inStock,
        },
      }
    }

    if (tool === 'dagi_orders_list') {
      const { StoreOrdersService } = await import('@/features/store/services/orders-service')
      const result = await StoreOrdersService.listOrdersForVendor(vendorEntityId, {
        limit: Math.min(20, Math.max(1, Number(args.limit) || 10)),
      })
      return {
        ok: true,
        tool,
        data: {
          items: result.items.map((o: { id: string; status?: string; total?: unknown }) => ({
            id: o.id,
            status: o.status,
            total: o.total,
          })),
        },
      }
    }

    if (tool === 'dagi_product_update_fields') {
      const productId = String(args.productId || '').trim()
      if (!productId) return { ok: false, tool, error: 'productId required' }
      const existing = await db().findDocById<Record<string, unknown>>('store_products', productId)
      if (!existing.success || !existing.data) {
        return { ok: false, tool, error: 'Product not found' }
      }
      const scopeErr = assertProductInVendorScope(existing.data, vendorEntityId)
      if (scopeErr) return { ok: false, tool, error: scopeErr }

      const patch: Record<string, unknown> = {}
      if (typeof args.name === 'string' && args.name.trim()) patch.name = args.name.trim()
      if (typeof args.description === 'string') patch.description = args.description
      if (typeof args.productAgent === 'string') patch.productAgent = args.productAgent
      if (Object.keys(patch).length === 0) {
        return { ok: false, tool, error: 'No allowed fields to update' }
      }

      const update = flattenProductDocumentForWrite(existing.data, patch)
      const result = await db().updateDoc('store_products', productId, update)
      if (!result.success) {
        return { ok: false, tool, error: result.error?.message || 'Update failed' }
      }
      return { ok: true, tool, data: { productId, updated: Object.keys(patch) } }
    }

    if (tool === 'dagi_research_product') {
      const productId = String(args.productId || '').trim()
      const productUrl = String(args.productUrl || '').trim()
      if (!productId || !productUrl) {
        return { ok: false, tool, error: 'productId and productUrl required' }
      }
      const existing = await db().findDocById<Record<string, unknown>>('store_products', productId)
      if (!existing.success || !existing.data) {
        return { ok: false, tool, error: 'Product not found' }
      }
      const scopeErr = assertProductInVendorScope(existing.data, vendorEntityId)
      if (scopeErr) return { ok: false, tool, error: scopeErr }

      const result = await researchProductAgentAction({
        productId,
        productUrl,
        customPrompt: typeof args.customPrompt === 'string' ? args.customPrompt : undefined,
      })
      if (result.error) return { ok: false, tool, error: result.error }
      return {
        ok: true,
        tool,
        data: {
          productId,
          productAgentPreview: (result.productAgent || '').slice(0, 200),
          wikiPageId: result.productNodusWiki?.wikiPageId,
          suggestedFields: result.fields,
          researchMedia: result.researchMedia,
          cabinetPath: result.cabinetPath,
          skippedImages: result.skippedImages,
        },
      }
    }

    return { ok: false, tool, error: `Unknown tool: ${tool}` }
  } catch (error) {
    return {
      ok: false,
      tool,
      error: error instanceof Error ? error.message : 'DAGI tool failed',
    }
  }
}

/** Resolve default bound vendor for DAGI chat when UI does not pass one. */
export async function resolveDagiVendorEntityId(
  sessionUserId: string,
  preferredEntityId?: string,
): Promise<string | null> {
  const owned = await getVendorEntities(sessionUserId)
  if (owned.length === 0) return null
  if (preferredEntityId && owned.some((e) => e.id === preferredEntityId)) {
    const ok = await hasFeatureForVendor(sessionUserId, preferredEntityId, 'vendor.dagi')
    return ok ? preferredEntityId : null
  }
  for (const e of owned) {
    if (await hasFeatureForVendor(sessionUserId, e.id, 'vendor.dagi')) {
      return e.id
    }
  }
  return null
}

/** Handlers closed over session + bound vendorEntityId — safe for Anthropic tool_use. */
export function buildDagiToolHandlers(ctx: {
  sessionUserId: string
  vendorEntityId: string
}): Map<string, (input: Record<string, unknown>) => Promise<unknown>> {
  const map = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>()
  for (const name of DAGI_ERP_TOOL_NAMES) {
    map.set(name, async (rawArgs) =>
      runDagiTool({
        sessionUserId: ctx.sessionUserId,
        vendorEntityId: ctx.vendorEntityId,
        tool: name,
        args: rawArgs,
      }),
    )
  }
  return map
}
