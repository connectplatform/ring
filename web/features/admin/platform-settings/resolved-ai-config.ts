import { getXaiTextConfig } from '@/lib/text/text.config'
import { resolveModel } from '@/lib/ai/model-router'
import {
  getPlatformAIData,
  getPlatformAISecrets,
} from '@/features/admin/platform-settings/platform-settings-service'
import {
  DEFAULT_PLATFORM_AI_DATA,
  type LlmProviderOption,
  type ResolvedAIConfig,
  type StreamingStrategy,
} from '@/features/admin/platform-settings/types'
import { resolveMatcherConfigFromEnv } from '@/features/admin/platform-settings/matcher-config'

function envProvider(): LlmProviderOption {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'anthropic') return 'anthropic'
  if (explicit === 'openrouter') return 'openrouter'
  if (explicit === 'xai') return 'xai'
  if (explicit === 'openai') return 'openai'
  if (process.env.OPENROUTER_API_KEY) return 'openrouter'
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return 'anthropic'
  return 'openai'
}

function envModel(provider: LlmProviderOption): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL
  try {
    if (provider === 'anthropic') {
      return resolveModel('chat_stream', {
        availableKeys: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'x' },
        preferred: [{ provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' }],
        ignoreEnvOverride: true,
      }).modelId
    }
    if (provider === 'openrouter') {
      return (
        process.env.OPENROUTER_MODEL_PRIMARY ||
        resolveModel('news_moderation_score', {
          availableKeys: { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'x' },
          ignoreEnvOverride: true,
        }).modelId
      )
    }
    if (provider === 'xai') return process.env.XAI_TEXT_MODEL || 'grok-4.3'
    return resolveModel('chat_stream', {
      availableKeys: { OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'x' },
      preferred: [{ provider: 'openai', modelId: 'gpt-5.6-terra' }],
      ignoreEnvOverride: true,
    }).modelId
  } catch {
    if (provider === 'anthropic') return 'claude-sonnet-4-5-20250929'
    if (provider === 'openrouter') return 'anthropic/claude-sonnet-4-5'
    if (provider === 'xai') return process.env.XAI_TEXT_MODEL || 'grok-4.3'
    return 'gpt-5.6-terra'
  }
}

function envApiKeys() {
  return {
    openai: process.env.OPENAI_API_KEY || undefined,
    anthropic: process.env.ANTHROPIC_API_KEY || undefined,
    openrouter: process.env.OPENROUTER_API_KEY || undefined,
    xai: process.env.XAI_API_KEY || undefined,
  }
}

function hasStreamingKey(
  provider: LlmProviderOption,
  keys: ResolvedAIConfig['apiKeys'],
): boolean {
  switch (provider) {
    case 'openai':
      return Boolean(keys.openai)
    case 'anthropic':
      return Boolean(keys.anthropic)
    case 'openrouter':
      return Boolean(keys.openrouter)
    case 'xai':
      return Boolean(keys.xai)
    default:
      return false
  }
}

export function isStreamingCompatibleResolved(config: ResolvedAIConfig): boolean {
  if (config.streamingStrategy === 'grok_only') return false
  if (config.streamingStrategy === 'env_only') {
    return hasStreamingKey(config.provider, config.apiKeys)
  }
  return hasStreamingKey(config.provider, config.apiKeys)
}

export async function getResolvedAIConfig(): Promise<ResolvedAIConfig> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    const provider = envProvider()
    return {
      provider,
      model: envModel(provider),
      streamingStrategy: 'env_then_grok',
      temperature: DEFAULT_PLATFORM_AI_DATA.productAgent.temperature,
      maxTokens: DEFAULT_PLATFORM_AI_DATA.productAgent.maxTokens,
      matcher: resolveMatcherConfigFromEnv(),
      productAgent: DEFAULT_PLATFORM_AI_DATA.productAgent,
      apiKeys: envApiKeys(),
      source: 'env',
    }
  }

  const [data, secrets] = await Promise.all([getPlatformAIData(), getPlatformAISecrets()])

  const hasDbRow = Boolean(
    data.llmProvider || data.llmModel || Object.values(secrets).some(Boolean),
  )

  const provider = (data.llmProvider || envProvider()) as LlmProviderOption
  const model = data.llmModel || envModel(provider)
  const streamingStrategy = data.streamingStrategy as StreamingStrategy

  const apiKeys = {
    openai: secrets.openaiApiKey || process.env.OPENAI_API_KEY || undefined,
    anthropic: secrets.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined,
    openrouter: secrets.openrouterApiKey || process.env.OPENROUTER_API_KEY || undefined,
    xai: secrets.xaiApiKey || process.env.XAI_API_KEY || undefined,
  }

  return {
    provider,
    model,
    streamingStrategy,
    temperature: data.productAgent.temperature,
    maxTokens: data.productAgent.maxTokens,
    matcher: data.matcher,
    productAgent: data.productAgent,
    apiKeys,
    source: hasDbRow ? 'db' : 'env',
  }
}

export async function resolveStreamingLLMTarget(): Promise<{
  useGrokFallback: boolean
  config: ResolvedAIConfig
}> {
  const config = await getResolvedAIConfig()

  if (config.streamingStrategy === 'grok_only') {
    return { useGrokFallback: true, config }
  }

  if (config.streamingStrategy === 'env_only') {
    return { useGrokFallback: false, config }
  }

  return {
    useGrokFallback: !isStreamingCompatibleResolved(config),
    config,
  }
}

export function buildLLMClientConfigFromResolved(
  config: ResolvedAIConfig,
  options?: { maxTokens?: number; temperature?: number },
) {
  const maxTokens = options?.maxTokens ?? config.maxTokens
  const temperature = options?.temperature ?? config.temperature

  if (config.provider === 'anthropic') {
    return {
      provider: 'anthropic' as const,
      model: config.model,
      apiKey: config.apiKeys.anthropic,
      temperature,
      maxTokens,
    }
  }

  if (config.provider === 'openrouter') {
    return {
      provider: 'openai' as const,
      model: config.model,
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKeys.openrouter,
      temperature,
      maxTokens,
    }
  }

  if (config.provider === 'xai') {
    const xai = getXaiTextConfig({ maxTokens, model: config.model })
    return {
      provider: 'openai' as const,
      model: config.model || xai.model,
      baseUrl: xai.baseUrl,
      apiKey: config.apiKeys.xai || xai.apiKey,
      temperature,
      maxTokens,
    }
  }

  return {
    provider: 'openai' as const,
    model: config.model,
    apiKey: config.apiKeys.openai,
    temperature,
    maxTokens,
  }
}
