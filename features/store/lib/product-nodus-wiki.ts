import 'server-only'

import { wikiCreateAction } from '@/app/_actions/wiki'
import { TENANT_VAULT } from '@/features/wiki/vault-key'
import type { ProductNodusWikiRef } from '@/features/store/types'
import type { WikiPage } from '@/features/wiki/types'
import { logger } from '@/lib/logger'

export async function createProductNodusWikiFromDraft(input: {
  productId: string
  productName: string
  productAgent?: string
  nodusJson?: Record<string, unknown>
}): Promise<ProductNodusWikiRef | undefined> {
  if (!input.nodusJson) return undefined
  const title = `Product NODUS — ${input.productName}`
  const bodyMarkdown = [
    `# ${title}`,
    '',
    `Product id: \`${input.productId}\``,
    '',
    '## Full NODUS',
    '',
    '```json',
    JSON.stringify(
      {
        ...input.nodusJson,
        product_id: input.productId,
        name: input.nodusJson.name || input.productName,
      },
      null,
      2,
    ),
    '```',
    '',
    '## Agent markdown',
    '',
    input.productAgent || '(not supplied)',
  ].join('\n')

  try {
    const page = (await wikiCreateAction({
      title,
      vaultKey: TENANT_VAULT,
      bodyMarkdown,
      kind: 'concept',
      frontmatter: {
        tags: ['product-nodus', 'store', `product:${input.productId}`],
        aliases: [`product-agent-${input.productId}`],
      },
    })) as WikiPage
    if (!page?.id) return undefined
    return {
      wikiPageId: page.id,
      wikiVaultKey: TENANT_VAULT,
      title,
      updatedAt: new Date().toISOString(),
      nodusPreview: {
        schema_version: input.nodusJson.schema_version,
        object_type: input.nodusJson.object_type,
        status: input.nodusJson.status,
        keywords: input.nodusJson.keywords,
      },
    }
  } catch (error) {
    logger.warn('[product-nodus-wiki] draft wiki create failed', {
      productId: input.productId,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
