import 'server-only'

import { WebConductor } from '@/lib/web'
import type { StoreProduct } from '@/features/store/types'
import type { Locale } from '@/i18n/shared'
import type {
  WebProductFieldSuggestions,
  WebProductImageCandidate,
} from '@/lib/web'

export type ProductResearchResult = {
  productAgentMarkdown: string
  nodusJson: Record<string, unknown>
  fields: WebProductFieldSuggestions
  imageCandidates: WebProductImageCandidate[]
  citations: string[]
  model?: string
}

/** Pre-filled Research prompt for FsModal (human-readable agent text + NODUS). */
export function buildProductResearchRequest(input: {
  productUrl: string
  productTitle: string
  categoryName: string
  description?: string
  sku?: string
}): string {
  const { productUrl, productTitle, categoryName, description, sku } = input
  return `Read ${productUrl} about ${productTitle} of ${categoryName} category.
Search web for product information and typical product parameters, benefits, use-cases and area of application, selling points, weak points, pitfalls, known problems, claims buyers should verify, and vital usage instructions for expectation satisfaction.
${sku ? `SKU: ${sku}. ` : ''}${description ? `Existing short description: ${description}. ` : ''}

Write a human-friendly, editable linear sales brief in Markdown. Cover: what it is, who it is for, key parameters, benefits, use-cases, caveats, and usage steps. Be factual; do not invent inventory counts or discounts.
Also prepare one product_agent_nodus object following AGENT-PRODUCT-SCHEMA: schema_version 1.0, mission with four keys, truth_lens, consult_when≥3, key_patterns≥2, keywords≥3, linear_description, vital_parameters, selling_points, weak_points, pitfalls, usage_instructions, claims_policy, session_tool_allowlist, priority, and status.`
}

/**
 * Manual enrichment via WebConductor → TextConductor web_search + structured product output.
 * Also triggered on admin approve (`updateAdminProductApproval`) and nightly
 * `product-agent-enrich` ProcessConductor cron.
 */
export async function runProductAgentResearch(input: {
  product: Pick<StoreProduct, 'id' | 'name' | 'category' | 'description' | 'sku'>
  productUrl: string
  locale?: Locale
  customPrompt?: string
}): Promise<ProductResearchResult> {
  const categoryName = input.product.category || 'General'
  const instruction =
    input.customPrompt?.trim() ||
    buildProductResearchRequest({
      productUrl: input.productUrl,
      productTitle: input.product.name,
      categoryName,
      description: input.product.description,
      sku: input.product.sku,
    })

  const result = await WebConductor.researchProduct({
    productUrl: input.productUrl,
    query: input.product.name,
    instruction,
    product: {
      id: input.product.id,
      name: input.product.name,
      category: categoryName,
      description: input.product.description,
      sku: input.product.sku,
      productUrl: input.productUrl,
    },
  })

  return {
    productAgentMarkdown: result.productAgentMarkdown,
    nodusJson: result.nodusJson,
    fields: result.fields,
    imageCandidates: result.imageCandidates,
    citations: result.citations,
    model: result.model,
  }
}
