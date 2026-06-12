import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { generateNewsArticle } from '@/features/news/services/article-generator'

type GenerateNewsBody = {
  source?: 'url' | 'search' | 'text'
  value?: string
  instruction?: string
  locale?: string
  enableAudio?: boolean
  enableImage?: boolean
}

export const POST = withMcpGuard(async (request, actor) => {
  const body = await readJsonBody<GenerateNewsBody>(request)
  const source = body?.source
  const value = body?.value?.trim()

  if (!source || !value) {
    return mcpError('source and value are required', 400)
  }
  if (!['url', 'search', 'text'].includes(source)) {
    return mcpError('source must be url, search, or text', 400)
  }

  const result = await generateNewsArticle({
    source,
    value,
    instruction: body.instruction,
    locale: body.locale,
    author: {
      id: actor.id,
      name: actor.name || actor.email || 'MCP Actor',
    },
    enableAudio: body.enableAudio,
    enableImage: body.enableImage,
  })

  if (!result.success) {
    return mcpError(result.error || 'Article generation failed', 502)
  }

  return mcpOk(result, 201)
})
