import 'server-only'

import { TextConductor } from '@/lib/text'

export interface WebProductDraft {
  id?: string
  name?: string
  category?: string
  description?: string
  sku?: string
  vendorName?: string
  productUrl?: string
}

export interface WebProductFieldSuggestions {
  name: string
  shortDescription: string
  longDescription: string
  category: string
  tags: string[]
  specifications: Array<{ name: string; value: string }>
}

export interface WebProductImageCandidate {
  imageUrl: string
  sourceUrl: string
  alt: string
  rationale: string
}

export interface WebProductResearchResult {
  fields: WebProductFieldSuggestions
  productAgentMarkdown: string
  nodusJson: Record<string, unknown>
  imageCandidates: WebProductImageCandidate[]
  citations: string[]
  model?: string
}

interface WebProductStructured extends Record<string, unknown> {
  name: string
  shortDescription: string
  longDescription: string
  category: string
  tags: string[]
  specifications: Array<{ name: string; value: string }>
  productAgentMarkdown: string
  nodusJson: string
  imageCandidates: WebProductImageCandidate[]
}

const WEB_PRODUCT_SCHEMA = {
  name: 'ring_store_web_product_research',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      shortDescription: {
        type: 'string',
        description: 'Factual plain-text description, at most 200 characters.',
      },
      longDescription: {
        type: 'string',
        description: 'Detailed factual Markdown description.',
      },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      specifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['name', 'value'],
          additionalProperties: false,
        },
      },
      productAgentMarkdown: {
        type: 'string',
        description:
          'Human-friendly sales knowledge in Markdown: fit, parameters, benefits, uses, caveats, and instructions.',
      },
      nodusJson: {
        type: 'string',
        description:
          'A JSON-encoded single product_agent_nodus object following AGENT-PRODUCT-SCHEMA.',
      },
      imageCandidates: {
        type: 'array',
        description:
          'Direct image URLs found on cited public product/manufacturer pages. Never invent URLs.',
        items: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string' },
            sourceUrl: { type: 'string' },
            alt: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: ['imageUrl', 'sourceUrl', 'alt', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'name',
      'shortDescription',
      'longDescription',
      'category',
      'tags',
      'specifications',
      'productAgentMarkdown',
      'nodusJson',
      'imageCandidates',
    ],
    additionalProperties: false,
  },
} as const

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => safeString(item)).filter(Boolean))].slice(0, 30)
}

function parseNodusJson(
  raw: string,
  draft: WebProductDraft,
  markdown: string,
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Deterministic draft fallback below.
  }

  const name = draft.name?.trim() || 'Product'
  const category = draft.category?.trim() || 'General'
  return {
    schema_version: '1.0',
    object_type: 'product_agent_nodus',
    product_id: draft.id || 'draft',
    sku: draft.sku || null,
    name,
    locale: 'en',
    mission: {
      primary_objective: `Help buyers understand ${name}.`,
      context: `You are the Ring Store sales agent for ${name}.`,
      target_outcome: 'Buyer understands fit, parameters, caveats, and purchase options.',
      scope: draft.id ? `Product id ${draft.id} only.` : 'This product draft only.',
    },
    truth_lens: 'Use verified product facts only; never invent stock, discounts, or policies.',
    consult_when: ['product fit', 'product parameters', 'usage guidance'],
    key_patterns: ['Answer from verified product knowledge.', 'State uncertainty explicitly.'],
    expertise: [category, 'product_sales'],
    keywords: [name, category, 'ring-store'].filter(Boolean),
    priority: 'medium',
    status: 'draft',
    linear_description: markdown,
    vital_parameters: {},
    selling_points: [],
    weak_points: [],
    pitfalls: [],
    usage_instructions: [],
    claims_policy: {
      may_claim: [],
      must_not_claim: ['Invented stock', 'Invented discounts', 'Unverified warranties'],
    },
    session_tool_allowlist: ['store.products.get', 'store.stock.get'],
    updated: new Date().toISOString().slice(0, 10),
  }
}

function normalizeImageCandidates(value: unknown): WebProductImageCandidate[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const output: WebProductImageCandidate[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const imageUrl = safeString(record.imageUrl)
    const sourceUrl = safeString(record.sourceUrl)
    if (!imageUrl || !sourceUrl || seen.has(imageUrl)) continue
    try {
      const image = new URL(imageUrl)
      const source = new URL(sourceUrl)
      if (!['http:', 'https:'].includes(image.protocol)) continue
      if (!['http:', 'https:'].includes(source.protocol)) continue
    } catch {
      continue
    }
    seen.add(imageUrl)
    output.push({
      imageUrl,
      sourceUrl,
      alt: safeString(record.alt, 'Product research image'),
      rationale: safeString(record.rationale, 'Relevant product reference'),
    })
    if (output.length >= 8) break
  }
  return output
}

function buildPrompt(input: {
  query?: string
  productUrl?: string
  product: WebProductDraft
  instruction?: string
}): string {
  const product = input.product
  return [
    'Research this Ring Store product using web search.',
    'Return only JSON matching the schema.',
    'Prefer manufacturer, official seller, standards, and reputable specialist sources.',
    'Never invent product facts, inventory, discounts, warranties, citations, or image URLs.',
    'For imageCandidates, include only direct public image URLs actually found on a cited source page.',
    'Images are inspiration alternatives: avoid logos, watermarks, tracking pixels, thumbnails under 300px, and unrelated lifestyle photos.',
    `Product URL: ${input.productUrl || product.productUrl || '(not supplied)'}`,
    `Search query: ${input.query || product.name || '(not supplied)'}`,
    `Current name: ${product.name || '(empty)'}`,
    `Current category: ${product.category || '(empty)'}`,
    `Current description: ${product.description || '(empty)'}`,
    `SKU: ${product.sku || '(empty)'}`,
    `Vendor/store: ${product.vendorName || '(empty)'}`,
    input.instruction ? `Operator instruction: ${input.instruction}` : '',
    'shortDescription must be no more than 200 characters.',
    'productAgentMarkdown must be linear human-readable Markdown, not JSON.',
    'nodusJson must encode one complete product_agent_nodus object.',
  ]
    .filter(Boolean)
    .join('\n')
}

export const WebConductor = {
  async researchProduct(input: {
    query?: string
    productUrl?: string
    product: WebProductDraft
    instruction?: string
  }): Promise<WebProductResearchResult> {
    const query = input.query?.trim() || input.productUrl?.trim() || input.product.name?.trim()
    if (!query) {
      throw new Error('Product name, URL, or search query is required')
    }

    const result = await TextConductor.generateStructured<WebProductStructured>(
      {
        input: buildPrompt(input),
        instructions:
          'You are Ring WebConductor, a verification-first product researcher. Use web_search, cite real sources, and return strict structured output.',
        webSearch: true,
        xSearch: false,
        maxTokens: 12000,
      },
      WEB_PRODUCT_SCHEMA,
    )

    if (!result.success || !result.structured) {
      throw new Error(result.error || 'Web product research failed')
    }

    const structured = result.structured
    const productAgentMarkdown =
      safeString(structured.productAgentMarkdown) ||
      safeString(structured.longDescription) ||
      safeString(input.product.description)
    const nodusJson = parseNodusJson(
      safeString(structured.nodusJson),
      input.product,
      productAgentMarkdown,
    )
    nodusJson.product_id = input.product.id || nodusJson.product_id || 'draft'
    nodusJson.name = safeString(structured.name) || input.product.name || nodusJson.name
    if (!nodusJson.linear_description) nodusJson.linear_description = productAgentMarkdown

    const providerCitations = (result.citations || []).filter((citation) => {
      try {
        return ['http:', 'https:'].includes(new URL(citation).protocol)
      } catch {
        return false
      }
    })
    const citedHosts = new Set(
      providerCitations.map((citation) => new URL(citation).hostname.toLowerCase()),
    )
    const imageCandidates = normalizeImageCandidates(structured.imageCandidates).filter(
      (candidate) => {
        try {
          return citedHosts.has(new URL(candidate.sourceUrl).hostname.toLowerCase())
        } catch {
          return false
        }
      },
    )
    const citations = [...providerCitations, ...imageCandidates.map((candidate) => candidate.sourceUrl)]

    return {
      fields: {
        name: safeString(structured.name, input.product.name || ''),
        shortDescription: safeString(
          structured.shortDescription,
          input.product.description || '',
        ).slice(0, 200),
        longDescription: safeString(structured.longDescription, productAgentMarkdown),
        category: safeString(structured.category, input.product.category || ''),
        tags: safeStringArray(structured.tags),
        specifications: Array.isArray(structured.specifications)
          ? structured.specifications
              .map((spec) => ({
                name: safeString(spec?.name),
                value: safeString(spec?.value),
              }))
              .filter((spec) => spec.name && spec.value)
              .slice(0, 40)
          : [],
      },
      productAgentMarkdown,
      nodusJson,
      imageCandidates,
      citations: [...new Set(citations.filter(Boolean))].slice(0, 40),
      model: result.model,
    }
  },

  /**
   * Storefront URL lane — research a vendor's existing live storefront for
   * description drafts and image candidates (same structured schema as product research).
   */
  async researchStorefront(input: {
    storefrontUrl: string
    vendorName?: string
    storeSlug?: string
    instruction?: string
  }): Promise<WebProductResearchResult> {
    const url = input.storefrontUrl.trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error('Valid storefront URL is required')
    }
    return WebConductor.researchProduct({
      productUrl: url,
      product: {
        name: input.vendorName || input.storeSlug || 'Storefront',
        vendorName: input.vendorName,
        productUrl: url,
        description: `Vendor storefront at ${url}`,
      },
      instruction:
        input.instruction?.trim() ||
        'Research this vendor storefront. Extract brand voice, category focus, and candidate product imagery from cited pages only. Prefer homepage and about/catalog pages.',
    })
  },
}
