'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db, initializeDatabase } from '@/lib/database'
import { flattenProductDocumentForWrite } from '@/features/store/lib/product-document'
import {
  buildProductResearchRequest,
  runProductAgentResearch,
} from '@/features/store/lib/product-agent-research'
import { wikiCreateAction, wikiUpdateAction } from '@/app/_actions/wiki'
import { isPlatformAdmin } from '@/features/auth/user-role'
import type { ProductNodusWikiRef } from '@/features/store/types'
import { TENANT_VAULT } from '@/features/wiki/vault-key'
import type { WikiFrontmatter, WikiPage } from '@/features/wiki/types'
import { getVendorEntityById } from '@/features/entities/services/vendor-entity'
import {
  saveProductResearchArtifacts,
  type ProductResearchMediaRef,
} from '@/features/store/lib/product-cabinet-media'
import type { WebProductFieldSuggestions } from '@/lib/web'

export type ProductAgentResearchActionResult = {
  success?: boolean
  error?: string
  productAgent?: string
  productNodusWiki?: ProductNodusWikiRef
  nodusJson?: Record<string, unknown>
  fields?: WebProductFieldSuggestions
  researchMedia?: ProductResearchMediaRef[]
  cabinetPath?: string
  skippedImages?: Array<{ imageUrl: string; reason: string }>
  citations?: string[]
}

async function resolveResearchVendor(input: {
  sessionUserId: string
  sessionRole?: string
  vendorEntityId: string
}) {
  const entity = await getVendorEntityById(input.vendorEntityId)
  if (!entity) throw new Error('Vendor entity not found or inactive')

  if (!isPlatformAdmin(input.sessionRole)) {
    const { checkEntityOwnership } = await import(
      '@/features/entities/utils/entity-utils'
    )
    const owns = await checkEntityOwnership(input.sessionUserId, input.vendorEntityId)
    if (!owns) throw new Error('Forbidden')
  }
  return entity
}

/**
 * Manual Research button → WebConductor → productAgent + wiki NODUS + cabinet artifacts.
 * TODO: Also trigger on product approve (optional).
 * TODO: Nightly ProcessConductor enrichment for stale products (optional).
 */
export async function researchProductAgentAction(input: {
  productId: string
  productUrl: string
  customPrompt?: string
}): Promise<ProductAgentResearchActionResult> {
  try {
    await initializeDatabase()
    const session = await auth()
    if (!session?.user?.id) {
      return { error: 'Unauthorized' }
    }

    const productId = String(input.productId || '').trim()
    if (!productId) return { error: 'productId required' }

    const existing = await db().findDocById<Record<string, unknown>>('store_products', productId)
    if (!existing.success || !existing.data) {
      return { error: 'Product not found' }
    }

    const entityId = String(
      existing.data.entity_id ||
        existing.data.entityId ||
        existing.data.ownerEntityId ||
        existing.data.vendorId ||
        '',
    )
    if (!entityId) return { error: 'Product has no vendor entity' }
    const vendorEntity = await resolveResearchVendor({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      vendorEntityId: entityId,
    })

    const name = String(existing.data.name || 'Product')
    const category = String(existing.data.category || 'General')
    const research = await runProductAgentResearch({
      product: {
        id: productId,
        name,
        category,
        description: existing.data.description ? String(existing.data.description) : undefined,
        sku: existing.data.sku ? String(existing.data.sku) : undefined,
      },
      productUrl: input.productUrl,
      customPrompt: input.customPrompt,
    })
    const cabinet = await saveProductResearchArtifacts({
      ownerUserId: vendorEntity.addedBy || session.user.id,
      storeName: vendorEntity.storeName || vendorEntity.name || entityId,
      productSlug: String(existing.data.slug || productId),
      markdown: research.productAgentMarkdown,
      citations: research.citations,
      imageCandidates: research.imageCandidates,
    })

    const wikiTitle = `Product NODUS — ${name}`
    const wikiBody = [
      `# ${wikiTitle}`,
      '',
      `Product id: \`${productId}\``,
      '',
      '## Citations',
      ...(research.citations.length
        ? research.citations.map((c) => `- ${c}`)
        : ['- (none)']),
      '',
      '## Full NODUS',
      '',
      '```json',
      JSON.stringify(research.nodusJson, null, 2),
      '```',
      '',
      '## Agent markdown (mirror)',
      '',
      research.productAgentMarkdown,
    ].join('\n')

    const existingWiki = existing.data.productNodusWiki as ProductNodusWikiRef | undefined
    let wikiPageId = existingWiki?.wikiPageId

    const wikiFrontmatter = {
      tags: ['product-nodus', 'store', `product:${productId}`],
      aliases: [`product-agent-${productId}`],
    } satisfies WikiFrontmatter

    if (wikiPageId) {
      await wikiUpdateAction(wikiPageId, {
        title: wikiTitle,
        bodyMarkdown: wikiBody,
        frontmatter: wikiFrontmatter,
      })
    } else {
      const created = (await wikiCreateAction({
        title: wikiTitle,
        vaultKey: TENANT_VAULT,
        bodyMarkdown: wikiBody,
        kind: 'concept',
        frontmatter: wikiFrontmatter,
      })) as WikiPage
      wikiPageId = created?.id || ''
      if (!wikiPageId) {
        console.warn('researchProductAgentAction: wiki create returned no id', created)
      }
    }

    const productNodusWiki: ProductNodusWikiRef | undefined = wikiPageId
      ? {
          wikiPageId,
          wikiVaultKey: TENANT_VAULT,
          title: wikiTitle,
          updatedAt: new Date().toISOString(),
          nodusPreview: {
            schema_version: research.nodusJson.schema_version,
            object_type: research.nodusJson.object_type,
            status: research.nodusJson.status,
            keywords: research.nodusJson.keywords,
          },
        }
      : undefined

    const previousMedia = Array.isArray(existing.data.productResearchMedia)
      ? (existing.data.productResearchMedia as ProductResearchMediaRef[])
      : []
    const update = flattenProductDocumentForWrite(existing.data, {
      productAgent: research.productAgentMarkdown,
      longDescription: research.productAgentMarkdown,
      productResearchFields: research.fields,
      productResearchMedia: [...previousMedia, ...cabinet.media],
      productResearchLastRun: {
        runId: cabinet.runId,
        cabinetPath: cabinet.cabinetPath,
        citations: research.citations,
        skippedImages: cabinet.skipped,
        researchedAt: new Date().toISOString(),
      },
      ...(productNodusWiki ? { productNodusWiki } : {}),
    })

    const result = await db().updateDoc('store_products', productId, update)
    if (!result.success) {
      return { error: result.error?.message || 'Failed to save product agent knowledge' }
    }

    revalidatePath('/admin/store/products')
    revalidatePath('/vendor/products')
    revalidatePath('/store')
    revalidatePath(`/store/${productId}`)
    revalidatePath('/admin/wiki')

    return {
      success: true,
      productAgent: research.productAgentMarkdown,
      productNodusWiki,
      nodusJson: research.nodusJson,
      fields: research.fields,
      researchMedia: cabinet.media,
      cabinetPath: cabinet.cabinetPath,
      skippedImages: cabinet.skipped,
      citations: research.citations,
    }
  } catch (error) {
    console.error('researchProductAgentAction failed:', error)
    return { error: error instanceof Error ? error.message : 'Research failed' }
  }
}

/** Web research for add-new-product before a CRM product id exists. */
export async function researchProductDraftAction(input: {
  vendorEntityId: string
  productName: string
  categoryName?: string
  description?: string
  sku?: string
  productUrl?: string
  customPrompt?: string
}): Promise<ProductAgentResearchActionResult> {
  try {
    await initializeDatabase()
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }

    const vendorEntityId = String(input.vendorEntityId || '').trim()
    const productName = String(input.productName || '').trim()
    if (!vendorEntityId) return { error: 'Vendor entity is required' }
    if (productName.length < 2) return { error: 'Enter a product name before research' }

    const vendorEntity = await resolveResearchVendor({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      vendorEntityId,
    })
    const productSlug = productName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `draft-${Date.now()}`
    const productUrl = String(input.productUrl || '').trim()
    const research = await runProductAgentResearch({
      product: {
        id: `draft:${vendorEntityId}:${productSlug}`,
        name: productName,
        category: input.categoryName || 'General',
        description: input.description,
        sku: input.sku,
      },
      productUrl,
      customPrompt: input.customPrompt,
    })
    const cabinet = await saveProductResearchArtifacts({
      ownerUserId: vendorEntity.addedBy || session.user.id,
      storeName: vendorEntity.storeName || vendorEntity.name || vendorEntityId,
      productSlug,
      markdown: research.productAgentMarkdown,
      citations: research.citations,
      imageCandidates: research.imageCandidates,
    })

    return {
      success: true,
      productAgent: research.productAgentMarkdown,
      nodusJson: research.nodusJson,
      fields: research.fields,
      researchMedia: cabinet.media,
      cabinetPath: cabinet.cabinetPath,
      skippedImages: cabinet.skipped,
      citations: research.citations,
    }
  } catch (error) {
    console.error('researchProductDraftAction failed:', error)
    return { error: error instanceof Error ? error.message : 'Draft research failed' }
  }
}

export async function buildDefaultResearchPromptAction(input: {
  productId: string
  productUrl: string
}): Promise<{ prompt?: string; error?: string }> {
  try {
    await initializeDatabase()
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }
    const existing = await db().findDocById<Record<string, unknown>>(
      'store_products',
      input.productId,
    )
    if (!existing.success || !existing.data) return { error: 'Product not found' }
    const entityId = String(
      existing.data.entity_id ||
        existing.data.entityId ||
        existing.data.ownerEntityId ||
        existing.data.vendorId ||
        '',
    )
    if (!entityId) return { error: 'Product has no vendor entity' }
    await resolveResearchVendor({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      vendorEntityId: entityId,
    })
    return {
      prompt: buildProductResearchRequest({
        productUrl: input.productUrl,
        productTitle: String(existing.data.name || 'Product'),
        categoryName: String(existing.data.category || 'General'),
        description: existing.data.description
          ? String(existing.data.description)
          : undefined,
        sku: existing.data.sku ? String(existing.data.sku) : undefined,
      }),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to build prompt' }
  }
}

/** Save Agent Knowledge fields from product form (without re-running research). */
export async function saveProductAgentKnowledgeAction(input: {
  productId: string
  productAgent: string
}): Promise<{ success?: boolean; error?: string }> {
  try {
    await initializeDatabase()
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }

    const existing = await db().findDocById<Record<string, unknown>>(
      'store_products',
      input.productId,
    )
    if (!existing.success || !existing.data) return { error: 'Product not found' }
    const entityId = String(
      existing.data.entity_id ||
        existing.data.entityId ||
        existing.data.ownerEntityId ||
        existing.data.vendorId ||
        '',
    )
    if (!entityId) return { error: 'Product has no vendor entity' }
    await resolveResearchVendor({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      vendorEntityId: entityId,
    })

    const update = flattenProductDocumentForWrite(existing.data, {
      productAgent: input.productAgent,
      longDescription: input.productAgent,
    })
    const result = await db().updateDoc('store_products', input.productId, update)
    if (!result.success) {
      return { error: result.error?.message || 'Failed to save' }
    }
    revalidatePath(`/store/${input.productId}`)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save' }
  }
}
