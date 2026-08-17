/**
 * Email CRM LLM bridge — resolveModelWithSettings + OpenRouter/Anthropic.
 * Prefer DeepSeek via OpenRouter; Haiku only when OpenRouter key missing.
 */

import Anthropic from '@anthropic-ai/sdk'
import { resolveModelWithSettings } from '@/lib/ai/model-router'
import type { ResolvedModel, TaskClass } from '@/lib/ai/model-router/types'
import { logger } from '@/lib/logger'

export type EmailLlmJsonResult = {
  text: string
  model: string
  provider: string
  tokens: { input: number; output: number }
  providerLlmCallId?: string | null
}

/**
 * Complete a JSON-oriented prompt. Returns raw model text (caller parses JSON).
 * Prefills `{` for Anthropic Messages; OpenRouter gets an explicit JSON instruction.
 */
export async function completeEmailJson(params: {
  taskClass: TaskClass
  system: string
  user: string
  maxTokens?: number
}): Promise<EmailLlmJsonResult> {
  const resolved = await resolveModelWithSettings(params.taskClass)
  const maxTokens = params.maxTokens ?? 400

  if (resolved.provider === 'anthropic') {
    return completeAnthropicJson(resolved, params.system, params.user, maxTokens)
  }

  return completeOpenAiCompatJson(resolved, params.system, params.user, maxTokens)
}

async function completeAnthropicJson(
  resolved: ResolvedModel,
  system: string,
  user: string,
  maxTokens: number
): Promise<EmailLlmJsonResult> {
  const client = new Anthropic({ apiKey: resolved.apiKey })
  const response = await client.messages.create({
    model: resolved.modelId,
    max_tokens: maxTokens,
    system,
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: '{' },
    ],
  })
  const block = response.content[0]
  const text = block?.type === 'text' ? `{${block.text}` : '{'
  return {
    text,
    model: resolved.modelId,
    provider: resolved.provider,
    tokens: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
    providerLlmCallId: response.id || null,
  }
}

async function completeOpenAiCompatJson(
  resolved: ResolvedModel,
  system: string,
  user: string,
  maxTokens: number
): Promise<EmailLlmJsonResult> {
  const baseUrl = resolved.endpoint.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}${resolved.endpoint.path.startsWith('/') ? '' : '/'}${resolved.endpoint.path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolved.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (resolved.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'https://ringdom.org'
    headers['X-Title'] = 'Ring Email CRM'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolved.modelId,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `${system}\n\nRespond with a single JSON object only. No markdown fences.`,
        },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    logger.error('[email-llm] OpenAI-compat request failed', {
      status: response.status,
      provider: resolved.provider,
      model: resolved.modelId,
      errText: errText.slice(0, 500),
    })
    throw new Error(`LLM ${resolved.provider} ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    id?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = data.choices?.[0]?.message?.content?.trim() || '{}'
  return {
    text,
    model: resolved.modelId,
    provider: resolved.provider,
    tokens: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
    providerLlmCallId: data.id || null,
  }
}

/** Plain text completion for draft replies (no JSON prefill). */
export async function completeEmailText(params: {
  taskClass: TaskClass
  system: string
  user: string
  maxTokens?: number
}): Promise<EmailLlmJsonResult> {
  const resolved = await resolveModelWithSettings(params.taskClass)
  const maxTokens = params.maxTokens ?? 1200

  if (resolved.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: resolved.apiKey })
    const response = await client.messages.create({
      model: resolved.modelId,
      max_tokens: maxTokens,
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
    })
    const block = response.content[0]
    const text = block?.type === 'text' ? block.text : ''
    return {
      text,
      model: resolved.modelId,
      provider: resolved.provider,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      providerLlmCallId: response.id || null,
    }
  }

  const baseUrl = resolved.endpoint.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}${resolved.endpoint.path.startsWith('/') ? '' : '/'}${resolved.endpoint.path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolved.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (resolved.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'https://ringdom.org'
    headers['X-Title'] = 'Ring Email CRM'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolved.modelId,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM ${resolved.provider} ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    id?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: data.choices?.[0]?.message?.content?.trim() || '',
    model: resolved.modelId,
    provider: resolved.provider,
    tokens: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
    providerLlmCallId: data.id || null,
  }
}
