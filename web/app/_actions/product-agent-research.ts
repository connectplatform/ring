'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db, initializeDatabase } from '@/lib/database'
import { flattenProductDocumentForWrite } from '@/features/store/lib/product-document'
import {
  buildProductResearchRequest,
  runProductAgentResearch,
} from '@/features/store/lib/product-agent-research'
import { wikiCreateAction, wikiListAction, wikiUpdateAction } from '@/app/_actions/wiki'
import { isPlatformAdmin } from '@/features/auth/user-role'
import type { ProductNodusWikiRef } from '@/features/store/types'
import { TENANT_VAULT } from '@/features/wiki/vault-key'
import type { WikiFrontmatter, WikiPage } from '@/features/wiki/types'
import { getVendorEntityById } from '@/features/entities/services/vendor-entity'
import { resolveVendorEntityId } from '@/features/store/lib/product-document'
import { billGenerativeTurn } from '@/features/generative-media/billing'
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
  if (!entity) {
    // Platform catalog rows (vendor_ring_portal_store and legacy imports) are not vendor entities.
    if (isPlatformAdmin(input.sessionRole)) {
      return {
        id: input.vendorEntityId,
        name: 'Ring Portal Store',
        storeName: 'ring-portal-store',
        addedBy: input.sessionUserId,
      }
    }
    throw new Error('Vendor entity not found or inactive')
  }

  if (!isPlatformAdmin(input.sessionRole)) {
    const { checkEntityOwnership } = await import(
      '@/features/entities/utils/entity-utils'
    )
    const owns = await checkEntityOwnership(input.sessionUserId, input.vendorEntityId)
    if (!owns) throw new Error('Forbidden')
  }
  return entity
}

function productVendorId(doc: Record<string, unknown>, role?: string | null): string {
  return resolveVendorEntityId(doc) || (isPlatformAdmin(role) ? 'vendor_ring_portal_store' : '')
}

function productNodusSlug(productId: string): string {
  return `product-nodus-${productId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function upsertProductNodusPage(input: {
  productId: string
  title: string
  bodyMarkdown: string
  frontmatter: WikiFrontmatter
  existingPageId?: string
}): Promise<string> {
  if (input.existingPageId) {
    await wikiUpdateAction(input.existingPageId, {
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      frontmatter: input.frontmatter,
    })
    return input.existingPageId
  }

  const slug = productNodusSlug(input.productId)
  try {
    const created = (await wikiCreateAction({
      title: input.title,
      slug,
      vaultKey: TENANT_VAULT,
      bodyMarkdown: input.bodyMarkdown,
      kind: 'concept',
      frontmatter: input.frontmatter,
    })) as WikiPage
    return created?.id || ''
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('Slug already exists')) throw error
    const pages = await wikiListAction(TENANT_VAULT)
    const existing = pages.find((page) => page.slug === slug)
    if (!existing) throw error
    await wikiUpdateAction(existing.id, {
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      frontmatter: input.frontmatter,
    })
    return existing.id
  }
}

/**
 * Manual Research button → WebConductor → productAgent + wiki NODUS + cabinet artifacts.
 * Approve path: `updateAdminProductApproval` (non-blocking).
 * Nightly: ProcessConductor pipeline `product-agent-enrich` (auth-free batch).
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

    const entityId = productVendorId(existing.data, session.user.role)
    if (!entityId) return { error: 'Product has no vendor entity' }
    const bill = await billGenerativeTurn({
      userId: session.user.id,
      action: 'product_research',
      referenceId: `product-research:${productId}:${Date.now()}`,
      metadata: { productId },
    })
    if (!bill.success) return { error: bill.error || 'Insufficient balance for research' }
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

    wikiPageId = await upsertProductNodusPage({
      productId,
      title: wikiTitle,
      bodyMarkdown: wikiBody,
      frontmatter: wikiFrontmatter,
      existingPageId: wikiPageId,
    })
    if (!wikiPageId) {
      console.warn('researchProductAgentAction: wiki upsert returned no id')
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
      longDescription: research.fields.longDescription || research.productAgentMarkdown,
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

    const bill = await billGenerativeTurn({
      userId: session.user.id,
      action: 'product_research',
      referenceId: `product-research-draft:${vendorEntityId}:${Date.now()}`,
      metadata: { vendorEntityId, productName },
    })
    if (!bill.success) return { error: bill.error || 'Insufficient balance for research' }

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
    const entityId = productVendorId(existing.data, session.user.role)
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
    const entityId = productVendorId(existing.data, session.user.role)
    if (!entityId) return { error: 'Product has no vendor entity' }
    await resolveResearchVendor({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      vendorEntityId: entityId,
    })

    const update = flattenProductDocumentForWrite(existing.data, {
      productAgent: input.productAgent,
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
