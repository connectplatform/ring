import { Pool } from 'pg'
import { initializeDatabase } from '@/lib/database'
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

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured')
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

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
  const client = await getPool().connect()
  try {
    const result = await client.query(
      `SELECT id, data, secrets, updated_by, updated_at FROM platform_settings WHERE id = $1`,
      [namespace],
    )
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    const data = parseJsonObject(row.data)
    const secrets = parseJsonObject(row.secrets) as Record<string, string>
    setCachedNamespace(namespace, data, secrets)
    return {
      data,
      secrets,
      updatedBy: row.updated_by as string | undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    }
  } finally {
    client.release()
  }
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

  const client = await getPool().connect()
  try {
    await client.query(
      `INSERT INTO platform_settings (id, data, secrets, updated_by, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         data = EXCLUDED.data,
         secrets = EXCLUDED.secrets,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [namespace, JSON.stringify(data), JSON.stringify(mergedSecrets), updatedBy],
    )
  } finally {
    client.release()
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
      const { getInstanceConfigFromFile } = await import('@/lib/ring-config-core')
      const fileCfg = getInstanceConfigFromFile()
      const data = platformBrandingDataSchema.parse({
        name: fileCfg.name,
        brand: fileCfg.brand,
        theme: fileCfg.theme || { default: 'system' },
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
