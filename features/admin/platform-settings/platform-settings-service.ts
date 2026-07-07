import { db, initializeDatabase } from '@/lib/database'
import { resolveMatcherConfigFromEnv } from '@/features/admin/platform-settings/matcher-config'
import {
  DEFAULT_PLATFORM_AI_DATA,
  DEFAULT_PLATFORM_BRANDING_DATA,
  platformAIDataSchema,
  platformAISecretsSchema,
  platformBrandingDataSchema,
  type MaskedPlatformAISecrets,
  type PlatformAIData,
  type PlatformAISettingsView,
  type PlatformAISecrets,
  type PlatformBrandingData,
  type PlatformSettingsNamespace,
} from '@/features/admin/platform-settings/types'
import {
  getCachedNamespace,
  invalidateNamespace,
  setCachedNamespace,
} from '@/features/admin/platform-settings/platform-settings-cache'

const PLATFORM_SETTINGS_COLLECTION = 'platform_settings'

const ROW_META_KEYS = new Set([
  'id',
  'secrets',
  'updatedBy',
  'updatedAt',
  'createdAt',
  'version',
])

function isDbDisabled(): boolean {
  return process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true'
}

function maskSecrets(secrets: PlatformAISecrets): MaskedPlatformAISecrets {
  return {
    hasOpenaiApiKey: Boolean(secrets.openaiApiKey),
    hasAnthropicApiKey: Boolean(secrets.anthropicApiKey),
    hasOpenrouterApiKey: Boolean(secrets.openrouterApiKey),
    hasXaiApiKey: Boolean(secrets.xaiApiKey),
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return {}
}

function extractNamespacePayload(row: Record<string, unknown>) {
  const secrets = parseJsonObject(row.secrets) as Record<string, string>
  const data = Object.fromEntries(
    Object.entries(row).filter(([key]) => !ROW_META_KEYS.has(key)),
  )
  const updatedBy = typeof row.updatedBy === 'string' ? row.updatedBy : undefined
  const updatedAt =
    row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row.updatedAt === 'string'
        ? row.updatedAt
        : undefined

  return { data, secrets, updatedBy, updatedAt }
}

async function readRow(namespace: PlatformSettingsNamespace) {
  if (isDbDisabled()) return null

  const cached = getCachedNamespace(namespace)
  if (cached) {
    return {
      data: cached.data,
      secrets: cached.secrets,
      updatedBy: undefined as string | undefined,
      updatedAt: undefined as string | undefined,
    }
  }

  await initializeDatabase()
  const result = await db().readDoc<Record<string, unknown>>(PLATFORM_SETTINGS_COLLECTION, namespace)
  if (!result.success || !result.data) return null

  const row = extractNamespacePayload(result.data)
  setCachedNamespace(namespace, row.data, row.secrets)
  return row
}

export async function getPlatformAIData(): Promise<PlatformAIData> {
  const row = await readRow('ai')
  if (!row) return DEFAULT_PLATFORM_AI_DATA
  return platformAIDataSchema.parse({ ...DEFAULT_PLATFORM_AI_DATA, ...row.data })
}

export async function getPlatformAISecrets(): Promise<PlatformAISecrets> {
  const row = await readRow('ai')
  if (!row) return {}
  return platformAISecretsSchema.parse(row.secrets)
}

export async function getPlatformAISettingsView(): Promise<PlatformAISettingsView> {
  const row = await readRow('ai')
  const data = row ? platformAIDataSchema.parse({ ...DEFAULT_PLATFORM_AI_DATA, ...row.data }) : DEFAULT_PLATFORM_AI_DATA
  const secrets = row ? platformAISecretsSchema.parse(row.secrets) : {}
  return {
    data,
    secrets: maskSecrets(secrets),
    updatedBy: row?.updatedBy,
    updatedAt: row?.updatedAt,
  }
}

export async function getPlatformBrandingData(): Promise<PlatformBrandingData> {
  const row = await readRow('branding')
  if (!row) return DEFAULT_PLATFORM_BRANDING_DATA
  return platformBrandingDataSchema.parse({ ...DEFAULT_PLATFORM_BRANDING_DATA, ...row.data })
}

export async function upsertPlatformNamespace(
  namespace: PlatformSettingsNamespace,
  data: Record<string, unknown>,
  secretsPatch: PlatformAISecrets | null,
  updatedBy: string,
) {
  if (isDbDisabled()) {
    throw new Error('Platform settings DB writes are disabled')
  }

  await initializeDatabase()
  const existing = await readRow(namespace)
  const mergedSecrets = secretsPatch
    ? {
        ...(existing?.secrets || {}),
        ...Object.fromEntries(
          Object.entries(secretsPatch).filter(([, value]) => typeof value === 'string' && value.trim()),
        ),
      }
    : existing?.secrets || {}

  const payload = {
    ...data,
    secrets: mergedSecrets,
    updatedBy,
  }

  const doc = await db().readDoc<Record<string, unknown>>(PLATFORM_SETTINGS_COLLECTION, namespace)
  if (doc.success && doc.data) {
    const update = await db().updateDoc(PLATFORM_SETTINGS_COLLECTION, namespace, payload)
    if (!update.success) {
      throw update.error || new Error(`Failed to update ${PLATFORM_SETTINGS_COLLECTION}/${namespace}`)
    }
  } else {
    const create = await db().createDoc(PLATFORM_SETTINGS_COLLECTION, payload, { id: namespace })
    if (!create.success) {
      throw create.error || new Error(`Failed to create ${PLATFORM_SETTINGS_COLLECTION}/${namespace}`)
    }
  }

  invalidateNamespace(namespace)
}

export async function importPlatformSettingsFromEnv(updatedBy: string): Promise<{ imported: string[] }> {
  const imported: string[] = []
  const aiExisting = await readRow('ai')
  if (!aiExisting) {
    const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
    const llmProvider =
      provider === 'anthropic'
        ? 'anthropic'
        : provider === 'openrouter'
          ? 'openrouter'
          : provider === 'xai'
            ? 'xai'
            : 'openai'

    const data = platformAIDataSchema.parse({
      llmProvider,
      llmModel:
        process.env.LLM_MODEL ||
        (llmProvider === 'anthropic'
          ? 'claude-3-5-sonnet-20241022'
          : llmProvider === 'xai'
            ? process.env.XAI_TEXT_MODEL || 'grok-4.3'
            : 'gpt-4o'),
      matcher: resolveMatcherConfigFromEnv(),
    })

    const secrets = platformAISecretsSchema.parse({
      openaiApiKey: process.env.OPENAI_API_KEY || undefined,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
      openrouterApiKey: process.env.OPENROUTER_API_KEY || undefined,
      xaiApiKey: process.env.XAI_API_KEY || undefined,
    })

    await upsertPlatformNamespace('ai', data, secrets, updatedBy)
    imported.push('ai')
  }

  const brandingExisting = await readRow('branding')
  if (!brandingExisting) {
    try {
      const { getSystemConfigSnapshot } = await import('@/lib/ring-config-core')
      const fileCfg = getSystemConfigSnapshot()
      const data = platformBrandingDataSchema.parse({
        name: fileCfg.seo.siteName,
        brand: fileCfg.branding,
        theme: fileCfg.theme.default || { default: 'system' },
        features: fileCfg.features,
      })
      await upsertPlatformNamespace('branding', data, {}, updatedBy)
      imported.push('branding')
    } catch {
      await upsertPlatformNamespace('branding', DEFAULT_PLATFORM_BRANDING_DATA, {}, updatedBy)
      imported.push('branding')
    }
  }

  return { imported }
}
