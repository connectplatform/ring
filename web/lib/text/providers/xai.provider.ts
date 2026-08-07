import { getXaiTextConfig } from '@/lib/text/text.config'
import type { GenerateTextContext } from '@/lib/text/conductor/types'

export interface XaiTextOutput {
  text: string
  structured?: Record<string, unknown>
  citations: string[]
  model: string
}

interface XaiResponsesPayload {
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{ type?: string; text?: string }>
  }>
  citations?: string[]
  error?: { message?: string }
}

function extractOutputText(payload: XaiResponsesPayload): string {
  const chunks: string[] = []
  for (const item of payload.output ?? []) {
    if (item.type !== 'message') continue
    for (const block of item.content ?? []) {
      if (block.type === 'output_text' && block.text) chunks.push(block.text)
      else if (block.text) chunks.push(block.text)
    }
  }
  return chunks.join('\n').trim()
}

function buildTools(ctx: GenerateTextContext, config: ReturnType<typeof getXaiTextConfig>) {
  const tools: Array<Record<string, unknown>> = []
  if (ctx.webSearch ?? config.webSearch) {
    const tool: Record<string, unknown> = { type: 'web_search' }
    if (ctx.allowedDomains?.length) tool.allowed_domains = ctx.allowedDomains.slice(0, 5)
    if (ctx.excludedDomains?.length) tool.excluded_domains = ctx.excludedDomains.slice(0, 5)
    tools.push(tool)
  }
  if (ctx.xSearch ?? config.xSearch) {
    tools.push({ type: 'x_search' })
  }
  return tools
}

export async function generateXaiText(ctx: GenerateTextContext): Promise<XaiTextOutput> {
  const config = getXaiTextConfig(ctx)
  if (!config.apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }
  if (!ctx.input?.trim()) {
    throw new Error('input is required')
  }

  const body: Record<string, unknown> = {
    model: config.model,
    input: [{ role: 'user', content: ctx.input.trim() }],
    max_output_tokens: config.maxTokens,
  }

  if (ctx.instructions?.trim()) {
    body.instructions = ctx.instructions.trim()
  }

  const tools = buildTools(ctx, config)
  if (tools.length > 0) {
    body.tools = tools
  }

  if (ctx.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: ctx.jsonSchema.name,
        strict: ctx.jsonSchema.strict ?? true,
        schema: ctx.jsonSchema.schema,
      },
    }
  }

  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as XaiResponsesPayload
  if (!response.ok) {
    throw new Error(payload.error?.message || `xAI text generation failed (${response.status})`)
  }

  const text = extractOutputText(payload)
  if (!text) {
    throw new Error('xAI returned empty text output')
  }

  let structured: Record<string, unknown> | undefined
  if (ctx.jsonSchema) {
    try {
      structured = JSON.parse(text) as Record<string, unknown>
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        structured = JSON.parse(match[0]) as Record<string, unknown>
      }
    }
  }

  return {
    text,
    structured,
    citations: Array.isArray(payload.citations) ? payload.citations : [],
    model: config.model,
  }
}
