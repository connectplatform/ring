import { getXaiTextConfig } from '@/lib/text/text.config'

/**
 * Unified LLM Client for Ring Platform
 *
 * Supports multiple LLM providers with automatic fallback, streaming, and OpenRouter.
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic'
  model: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
  baseUrl?: string
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  provider: string
  model: string
}

export interface LLMStreamMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMStreamChunk {
  type: 'token' | 'done' | 'error'
  content?: string
  usage?: LLMResponse['usage']
  error?: string
}

export class LLMError extends Error {
  provider: string
  model: string
  code?: string
  retryable: boolean

  constructor(
    message: string,
    options: {
      provider: string
      model: string
      code?: string
      retryable?: boolean
    },
  ) {
    super(message)
    this.name = 'LLMError'
    this.provider = options.provider
    this.model = options.model
    this.code = options.code
    this.retryable = options.retryable ?? true
  }
}

export class LLMClient {
  private config: LLMConfig
  private fallbackClient?: LLMClient

  constructor(config: LLMConfig, fallbackConfig?: LLMConfig) {
    this.config = config
    if (fallbackConfig) {
      this.fallbackClient = new LLMClient(fallbackConfig)
    }
  }

  private getApiKey(): string {
    if (this.config.apiKey) return this.config.apiKey

    if (this.config.baseUrl?.includes('openrouter.ai')) {
      const key = process.env.OPENROUTER_API_KEY
      if (!key) {
        throw new LLMError('Missing OPENROUTER_API_KEY', {
          provider: this.config.provider,
          model: this.config.model,
          retryable: false,
        })
      }
      return key
    }

    if (this.config.baseUrl?.includes('api.x.ai')) {
      const key = process.env.XAI_API_KEY
      if (!key) {
        throw new LLMError('Missing XAI_API_KEY', {
          provider: this.config.provider,
          model: this.config.model,
          retryable: false,
        })
      }
      return key
    }

    const envKey =
      this.config.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY

    if (!envKey) {
      throw new LLMError(`Missing API key for ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        retryable: false,
      })
    }

    return envKey
  }

  private getChatCompletionsUrl(): string {
    const base = this.config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
    return `${base}/chat/completions`
  }

  async complete(prompt: string, options: Partial<LLMConfig> = {}): Promise<LLMResponse> {
    const requestConfig = { ...this.config, ...options }

    try {
      const apiKey = this.getApiKey()

      if (requestConfig.provider === 'openai') {
        return await this.callOpenAI(prompt, requestConfig, apiKey)
      }
      if (requestConfig.provider === 'anthropic') {
        return await this.callAnthropic(prompt, requestConfig, apiKey)
      }

      throw new LLMError(`Unsupported provider: ${requestConfig.provider}`, {
        provider: requestConfig.provider,
        model: requestConfig.model,
        retryable: false,
      })
    } catch (error) {
      if (this.fallbackClient && error instanceof LLMError && error.retryable) {
        console.warn(`LLM: Primary provider failed, trying fallback: ${error.message}`)
        return await this.fallbackClient.complete(prompt, options)
      }
      throw error
    }
  }

  async *streamMessages(
    messages: LLMStreamMessage[],
    options: Partial<LLMConfig> & { system?: string } = {},
  ): AsyncGenerator<LLMStreamChunk> {
    const requestConfig = { ...this.config, ...options }

    try {
      const apiKey = this.getApiKey()

      if (requestConfig.provider === 'anthropic') {
        yield* this.streamAnthropicMessages(messages, requestConfig, apiKey, options.system)
        return
      }

      if (requestConfig.provider === 'openai') {
        yield* this.streamOpenAIMessages(messages, requestConfig, apiKey, options.system)
        return
      }

      yield { type: 'error', error: `Streaming unsupported for provider: ${requestConfig.provider}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed'
      yield { type: 'error', error: message }
    }
  }

  private async callOpenAI(
    prompt: string,
    config: LLMConfig,
    apiKey: string,
  ): Promise<LLMResponse> {
    const response = await fetch(this.getChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(config.baseUrl?.includes('openrouter.ai')
          ? {
              'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://ring-platform.org',
              'X-Title': process.env.OPENROUTER_APP_NAME || 'Ring Platform',
            }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new LLMError(`OpenAI API error: ${response.status} ${response.statusText}`, {
        provider: 'openai',
        model: config.model,
        code: (errorData as { error?: { code?: string } }).error?.code,
        retryable: response.status >= 500 || response.status === 429,
      })
    }

    const data = await response.json()

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      provider: config.baseUrl?.includes('openrouter.ai') ? 'openrouter' : 'openai',
      model: config.model,
    }
  }

  private async callAnthropic(
    prompt: string,
    config: LLMConfig,
    apiKey: string,
  ): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 1000,
        temperature: config.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new LLMError(`Anthropic API error: ${response.status} ${response.statusText}`, {
        provider: 'anthropic',
        model: config.model,
        code: (errorData as { error?: { type?: string } }).error?.type,
        retryable: response.status >= 500 || response.status === 429,
      })
    }

    const data = await response.json()

    return {
      content: data.content[0]?.text || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      provider: 'anthropic',
      model: config.model,
    }
  }

  private async *streamOpenAIMessages(
    messages: LLMStreamMessage[],
    config: LLMConfig,
    apiKey: string,
    system?: string,
  ): AsyncGenerator<LLMStreamChunk> {
    const chatMessages = system
      ? [{ role: 'system' as const, content: system }, ...messages]
      : messages

    const response = await fetch(this.getChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(config.baseUrl?.includes('openrouter.ai')
          ? {
              'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://ring-platform.org',
              'X-Title': process.env.OPENROUTER_APP_NAME || 'Ring Platform',
            }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: chatMessages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      yield {
        type: 'error',
        error: `OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`,
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body from OpenAI-compatible provider' }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage: LLMResponse['usage'] | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const event = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          }

          const token = event.choices?.[0]?.delta?.content
          if (token) yield { type: 'token', content: token }

          if (event.usage) {
            usage = {
              promptTokens: event.usage.prompt_tokens ?? 0,
              completionTokens: event.usage.completion_tokens ?? 0,
              totalTokens: event.usage.total_tokens ?? 0,
            }
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    }

    yield { type: 'done', usage }
  }

  private async *streamAnthropicMessages(
    messages: LLMStreamMessage[],
    config: LLMConfig,
    apiKey: string,
    system?: string,
  ): AsyncGenerator<LLMStreamChunk> {
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens ?? 1000,
      temperature: config.temperature ?? 0.7,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }

    if (system) {
      body.system = system
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      yield {
        type: 'error',
        error: `Anthropic API error: ${response.status} ${JSON.stringify(errorData)}`,
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body from Anthropic' }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage: LLMResponse['usage'] | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const event = JSON.parse(payload) as {
            type?: string
            delta?: { type?: string; text?: string }
            usage?: { input_tokens?: number; output_tokens?: number }
          }

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text || ''
            if (text) yield { type: 'token', content: text }
          }

          if (event.type === 'message_delta' && event.usage) {
            usage = {
              promptTokens: event.usage.input_tokens ?? 0,
              completionTokens: event.usage.output_tokens ?? 0,
              totalTokens: (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
            }
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    }

    yield { type: 'done', usage }
  }

  async batchComplete(prompts: string[], options: Partial<LLMConfig> = {}): Promise<LLMResponse[]> {
    const results: LLMResponse[] = []

    for (const prompt of prompts) {
      try {
        const result = await this.complete(prompt, options)
        results.push(result)
      } catch (error) {
        console.error('LLM: Batch completion failed for prompt:', error)
        results.push({
          content: '',
          provider: this.config.provider,
          model: this.config.model,
        })
      }
    }

    return results
  }
}

/** @deprecated Env-only check — prefer getResolvedAIConfig + createLLMClientAsync */
export function isStreamingCompatibleEnvProvider(): boolean {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase()

  if (explicit === 'xai') {
    return false
  }

  if (explicit === 'openrouter' || (explicit === '' && process.env.OPENROUTER_API_KEY)) {
    return !!process.env.OPENROUTER_API_KEY
  }

  if (explicit === 'anthropic' || (explicit === '' && process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY)) {
    return !!process.env.ANTHROPIC_API_KEY
  }

  if (explicit === 'openai' || process.env.OPENAI_API_KEY) {
    return !!process.env.OPENAI_API_KEY
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return true
  }

  if (process.env.OPENROUTER_API_KEY) {
    return true
  }

  return false
}

export async function createLLMClientAsync(fallback: boolean = true): Promise<LLMClient> {
  const {
    getResolvedAIConfig,
    buildLLMClientConfigFromResolved,
  } = await import('@/features/admin/platform-settings/resolved-ai-config')
  const resolved = await getResolvedAIConfig()
  const primary = buildLLMClientConfigFromResolved(resolved)
  let fallbackConfig: LLMConfig | undefined

  if (fallback && resolved.provider === 'openai' && resolved.apiKeys.anthropic) {
    fallbackConfig = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: resolved.apiKeys.anthropic,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
    }
  } else if (fallback && resolved.provider === 'anthropic' && resolved.apiKeys.openai) {
    fallbackConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: resolved.apiKeys.openai,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
    }
  }

  return new LLMClient(primary, fallbackConfig)
}

export async function createStreamingLLMClientAsync(fallback: boolean = true): Promise<LLMClient> {
  const {
    resolveStreamingLLMTarget,
    buildLLMClientConfigFromResolved,
  } = await import('@/features/admin/platform-settings/resolved-ai-config')

  const { useGrokFallback, config } = await resolveStreamingLLMTarget()

  if (!useGrokFallback) {
    return createLLMClientAsync(fallback)
  }

  const xai = getXaiTextConfig({
    maxTokens: config.productAgent.maxTokens,
    model: config.apiKeys.xai ? config.model : undefined,
  })
  const apiKey = config.apiKeys.xai || xai.apiKey
  if (apiKey) {
    return new LLMClient({
      provider: 'openai',
      model: config.model || xai.model,
      baseUrl: xai.baseUrl,
      apiKey,
      temperature: config.productAgent.temperature,
      maxTokens: config.productAgent.maxTokens,
    })
  }

  return createLLMClientAsync(fallback)
}

/** Env-only synchronous factory (legacy callers). */
export function createStreamingLLMClient(fallback: boolean = true): LLMClient {
  if (isStreamingCompatibleEnvProvider()) {
    return createLLMClient(fallback)
  }

  const xai = getXaiTextConfig({ maxTokens: 600 })
  if (xai.apiKey) {
    return new LLMClient({
      provider: 'openai',
      model: xai.model,
      baseUrl: xai.baseUrl,
      apiKey: xai.apiKey,
      temperature: 0.35,
      maxTokens: 600,
    })
  }

  return createLLMClient(fallback)
}

export function createLLMClient(fallback: boolean = true): LLMClient {
  const providerEnv = (process.env.LLM_PROVIDER || 'openai').toLowerCase()

  if (providerEnv === 'openrouter' || process.env.OPENROUTER_API_KEY) {
    const primaryConfig: LLMConfig = {
      provider: 'openai',
      model: process.env.LLM_MODEL || 'anthropic/claude-3.5-sonnet',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      temperature: 0.7,
      maxTokens: 1000,
    }

    let fallbackConfig: LLMConfig | undefined
    if (fallback && process.env.ANTHROPIC_API_KEY) {
      fallbackConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 1000,
      }
    }

    return new LLMClient(primaryConfig, fallbackConfig)
  }

  const provider = (providerEnv === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic'

  const primaryConfig: LLMConfig = {
    provider,
    model:
      provider === 'openai'
        ? process.env.LLM_MODEL || 'gpt-4o'
        : process.env.LLM_MODEL || 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 1000,
  }

  let fallbackConfig: LLMConfig | undefined

  if (fallback) {
    if (provider === 'openai' && process.env.ANTHROPIC_API_KEY) {
      fallbackConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 1000,
      }
    } else if (provider === 'anthropic' && process.env.OPENAI_API_KEY) {
      fallbackConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
      }
    }
  }

  return new LLMClient(primaryConfig, fallbackConfig)
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function isLLMAvailable(): boolean {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.XAI_API_KEY
  )
}

export async function isLLMAvailableAsync(): Promise<boolean> {
  try {
    const { getResolvedAIConfig } = await import(
      '@/features/admin/platform-settings/resolved-ai-config'
    )
    const resolved = await getResolvedAIConfig()
    return Object.values(resolved.apiKeys).some(Boolean)
  } catch {
    return isLLMAvailable()
  }
}

export function normalizeStreamMessages(messages: LLMStreamMessage[]): LLMStreamMessage[] {
  const trimmed = messages.filter((message) => message.content.trim())
  let normalized = [...trimmed]

  while (normalized.length > 0 && normalized[0].role === 'assistant') {
    normalized.shift()
  }

  const merged: LLMStreamMessage[] = []
  for (const message of normalized) {
    const last = merged[merged.length - 1]
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${message.content}`
      continue
    }
    merged.push({ ...message })
  }

  return merged
}
