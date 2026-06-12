'use server'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/user-role'
import {
  platformAIDataSchema,
  platformAISecretsSchema,
  platformBrandingDataSchema,
  type PlatformBrandingData,
} from '@/features/admin/platform-settings/types'
import {
  getPlatformAISettingsView,
  getPlatformBrandingData,
  importPlatformSettingsFromEnv,
  upsertPlatformNamespace,
} from '@/features/admin/platform-settings/platform-settings-service'
import { invalidateNamespace } from '@/features/admin/platform-settings/platform-settings-cache'
import { invalidateInstanceConfigCache } from '@/lib/ring-config-core'
import { createLLMClientAsync } from '@/lib/ai/llm-client'

export type PlatformSettingsActionState = {
  success: boolean
  message: string
}

async function requireSuperAdmin(): Promise<{ userId: string; email: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  if (session.user.role !== UserRole.SUPERADMIN) {
    throw new Error('SuperAdmin access required')
  }
  return {
    userId: session.user.id,
    email: session.user.email || session.user.id,
  }
}

export async function ensurePlatformSettingsSeeded(): Promise<{ imported: string[] }> {
  const { email } = await requireSuperAdmin()
  return importPlatformSettingsFromEnv(email)
}

export async function updatePlatformAISettings(
  _prev: PlatformSettingsActionState | null,
  formData: FormData,
): Promise<PlatformSettingsActionState> {
  try {
    const { email } = await requireSuperAdmin()

    const raw = {
      llmProvider: String(formData.get('llmProvider') || 'openai'),
      llmModel: String(formData.get('llmModel') || '').trim(),
      streamingStrategy: String(formData.get('streamingStrategy') || 'env_then_grok'),
      matcher: {
        scoreThreshold: Number.parseFloat(String(formData.get('matcherScoreThreshold') || '0.7')),
        maxMatches: Number.parseInt(String(formData.get('matcherMaxMatches') || '10'), 10),
        autoApprove: formData.get('matcher_auto_approve') === 'on',
        autoApproveMinScore: Number.parseFloat(
          String(formData.get('matcher_auto_approve_min_score') || '0.7'),
        ),
      },
      productAgent: {
        maxTokens: Number.parseInt(String(formData.get('productAgentMaxTokens') || '600'), 10),
        temperature: Number.parseFloat(String(formData.get('productAgentTemperature') || '0.35')),
      },
    }

    const data = platformAIDataSchema.parse(raw)

    const secretsPatch = platformAISecretsSchema.parse({
      openaiApiKey: optionalSecret(formData.get('openaiApiKey')),
      anthropicApiKey: optionalSecret(formData.get('anthropicApiKey')),
      openrouterApiKey: optionalSecret(formData.get('openrouterApiKey')),
      xaiApiKey: optionalSecret(formData.get('xaiApiKey')),
    })

    await upsertPlatformNamespace('ai', data, secretsPatch, email)
    invalidateNamespace('ai')

    return { success: true, message: 'AI settings saved' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save AI settings',
    }
  }
}

export async function updatePlatformBrandingSettings(
  _prev: PlatformSettingsActionState | null,
  formData: FormData,
): Promise<PlatformSettingsActionState> {
  try {
    const { email } = await requireSuperAdmin()
    const existing = await getPlatformBrandingData()

    const featureKeys = ['news', 'opportunities', 'entities', 'messaging', 'admin'] as const
    const features: Record<string, boolean> = { ...existing.features }
    for (const key of featureKeys) {
      features[key] = formData.get(`feature_${key}`) === 'on'
    }

    const categoriesRaw = String(formData.get('customEntityCategories') || '')
    const customEntityCategories = categoriesRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const data = platformBrandingDataSchema.parse({
      name: String(formData.get('name') || existing.name),
      shortDescription: String(formData.get('shortDescription') || '') || undefined,
      extendedDescription: String(formData.get('extendedDescription') || '') || undefined,
      brand: {
        ...existing.brand,
        colors: {
          primary: String(formData.get('colorPrimary') || existing.brand.colors.primary),
          background: String(formData.get('colorBackground') || existing.brand.colors.background),
          foreground: String(formData.get('colorForeground') || existing.brand.colors.foreground),
          accent: String(formData.get('colorAccent') || existing.brand.colors.accent),
        },
      },
      theme: {
        default: String(formData.get('defaultTheme') || existing.theme.default) as
          | 'light'
          | 'dark'
          | 'system',
      },
      features,
      customEntityCategories,
    })

    await upsertPlatformNamespace('branding', data, {}, email)
    invalidateNamespace('branding')
    invalidateInstanceConfigCache()

    return { success: true, message: 'Branding settings saved' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save branding settings',
    }
  }
}

export type TestConnectionResult = PlatformSettingsActionState & {
  latencyMs?: number
}

export async function testPlatformAIConnection(): Promise<TestConnectionResult> {
  try {
    await requireSuperAdmin()
    const start = Date.now()
    const client = await createLLMClientAsync(false)
    const response = await client.complete('Reply with exactly: OK', {
      maxTokens: 8,
      temperature: 0,
    })
    const latencyMs = Date.now() - start
    const ok = response.content.toUpperCase().includes('OK')
    return {
      success: ok,
      message: ok ? `Connection OK (${latencyMs}ms)` : `Unexpected response: ${response.content.slice(0, 80)}`,
      latencyMs,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    }
  }
}

export async function loadPlatformSettingsForAdmin() {
  await ensurePlatformSettingsSeeded()
  const [ai, branding] = await Promise.all([
    getPlatformAISettingsView(),
    getPlatformBrandingData(),
  ])
  return { ai, branding }
}

function optionalSecret(value: FormDataEntryValue | null): string | undefined {
  const str = String(value || '').trim()
  if (!str || str === '••••••••') return undefined
  return str
}
