import { z } from 'zod'
import { getPublicInstanceConfigFromSnapshot } from '@/lib/ring-config-core'

export const PLATFORM_SETTING_NAMESPACES = ['ai', 'branding'] as const
export type PlatformSettingsNamespace = (typeof PLATFORM_SETTING_NAMESPACES)[number]

export const LLM_PROVIDER_OPTIONS = ['openai', 'anthropic', 'openrouter', 'xai'] as const
export type LlmProviderOption = (typeof LLM_PROVIDER_OPTIONS)[number]

export const STREAMING_STRATEGY_OPTIONS = ['env_then_grok', 'env_only', 'grok_only'] as const
export type StreamingStrategy = (typeof STREAMING_STRATEGY_OPTIONS)[number]

export const platformAISecretsSchema = z.object({
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
  xaiApiKey: z.string().optional(),
})

export const platformAIDataSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDER_OPTIONS).default('openai'),
  llmModel: z.string().min(1).default('gpt-4o'),
  streamingStrategy: z.enum(STREAMING_STRATEGY_OPTIONS).default('env_then_grok'),
  matcher: z
    .object({
      scoreThreshold: z.number().min(0).max(1).default(0.7),
      maxMatches: z.number().int().min(1).max(100).default(10),
      autoApprove: z.boolean().default(false),
      autoApproveMinScore: z.number().min(0).max(1).default(0.7),
    })
    .default({
      scoreThreshold: 0.7,
      maxMatches: 10,
      autoApprove: false,
      autoApproveMinScore: 0.7,
    }),
  productAgent: z
    .object({
      maxTokens: z.number().int().min(64).max(8000).default(600),
      temperature: z.number().min(0).max(2).default(0.35),
    })
    .default({ maxTokens: 600, temperature: 0.35 }),
})

export const platformBrandingDataSchema = z.object({
  name: z.string().min(1).default('Ring Platform'),
  shortDescription: z.string().optional(),
  extendedDescription: z.string().optional(),
  brand: z.object({
    colors: z.object({
      primary: z.string().default('#3b82f6'),
      background: z.string().default('#0b0f1a'),
      foreground: z.string().default('#e5e7eb'),
      accent: z.string().default('#22c55e'),
    }),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    ogImageUrl: z.string().optional(),
  }),
  theme: z.object({
    default: z.enum(['light', 'dark', 'system']).default('system'),
  }),
  features: z.record(z.string(), z.boolean()).default({
    entities: true,
    opportunities: true,
    messaging: true,
    admin: true,
    news: true,
  }),
  customEntityCategories: z.array(z.string()).default([]),
})

export type PlatformAIData = z.infer<typeof platformAIDataSchema>
export type PlatformAISecrets = z.infer<typeof platformAISecretsSchema>
export type PlatformBrandingData = z.infer<typeof platformBrandingDataSchema>

export type PlatformSettingsRow<TData = Record<string, unknown>> = {
  id: PlatformSettingsNamespace
  data: TData
  secrets: PlatformAISecrets
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export type MaskedPlatformAISecrets = {
  hasOpenaiApiKey: boolean
  hasAnthropicApiKey: boolean
  hasOpenrouterApiKey: boolean
  hasXaiApiKey: boolean
}

export type PlatformAISettingsView = {
  data: PlatformAIData
  secrets: MaskedPlatformAISecrets
  updatedBy?: string
  updatedAt?: string
}

export type ResolvedAIConfig = {
  provider: LlmProviderOption
  model: string
  streamingStrategy: StreamingStrategy
  temperature: number
  maxTokens: number
  matcher: PlatformAIData['matcher']
  productAgent: PlatformAIData['productAgent']
  apiKeys: {
    openai?: string
    anthropic?: string
    openrouter?: string
    xai?: string
  }
  source: 'db' | 'env' | 'default'
}

export const DEFAULT_PLATFORM_AI_DATA: PlatformAIData = platformAIDataSchema.parse({})
const _ringBrandingSnapshot = getPublicInstanceConfigFromSnapshot()

export const DEFAULT_PLATFORM_BRANDING_DATA: PlatformBrandingData = platformBrandingDataSchema.parse({
  name: _ringBrandingSnapshot.name,
  brand: _ringBrandingSnapshot.brand,
  theme: _ringBrandingSnapshot.theme ?? { default: 'system' },
  features: _ringBrandingSnapshot.features,
})
