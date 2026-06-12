/**
 * Smoke: platform_settings DB namespace + AI config resolver.
 *
 * Temporarily patches the `ai` namespace, exercises resolver + service, restores prior row.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
 *   npx tsx scripts/smoke-platform-settings.cts [--keep]
 */

import { Pool } from 'pg'
import { initializeDatabase } from '@/lib/database'
import {
  getPlatformAIData,
  upsertPlatformNamespace,
} from '@/features/admin/platform-settings/platform-settings-service'
import { getResolvedAIConfig } from '@/features/admin/platform-settings/resolved-ai-config'
import { invalidateNamespace } from '@/features/admin/platform-settings/platform-settings-cache'

const KEEP = process.argv.includes('--keep')
const UPDATED_BY = 'smoke-platform-settings'
const SMOKE_MODEL = 'smk_gpt-4o-mini'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  console.log('\n🧪 smoke-platform-settings\n')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  await initializeDatabase()
  const pool = new Pool({ connectionString })

  let prior: { data: unknown; secrets: unknown } | null = null

  try {
    const existing = await pool.query(
      `SELECT data, secrets FROM platform_settings WHERE id = 'ai'`,
    )
    if (existing.rows.length > 0) {
      prior = {
        data: existing.rows[0].data,
        secrets: existing.rows[0].secrets,
      }
    }

    const smokeData = {
      llmProvider: 'openai' as const,
      llmModel: SMOKE_MODEL,
      streamingStrategy: 'env_only' as const,
      matcher: { scoreThreshold: 0.65, maxMatches: 7 },
      productAgent: { maxTokens: 512, temperature: 0.25 },
    }

    await upsertPlatformNamespace('ai', smokeData, { openaiApiKey: 'smk_test_key_openai' }, UPDATED_BY)
    invalidateNamespace('ai')

    const row = await pool.query(`SELECT data FROM platform_settings WHERE id = 'ai'`)
    ok('ai row persisted', row.rows.length === 1)
    ok('smoke model stored', row.rows[0]?.data?.llmModel === SMOKE_MODEL)

    const data = await getPlatformAIData()
    ok('getPlatformAIData reads smoke model', data.llmModel === SMOKE_MODEL)
    ok('matcher.maxMatches', data.matcher.maxMatches === 7)

    const resolved = await getResolvedAIConfig()
    ok('getResolvedAIConfig model', resolved.model === SMOKE_MODEL)
    ok('resolver has openai key', Boolean(resolved.apiKeys.openai))
    ok('resolver matcher threshold', resolved.matcher.scoreThreshold === 0.65)

    if (!KEEP) {
      if (prior) {
        await pool.query(
          `UPDATE platform_settings SET data = $1::jsonb, secrets = $2::jsonb, updated_by = $3, updated_at = NOW() WHERE id = 'ai'`,
          [JSON.stringify(prior.data), JSON.stringify(prior.secrets), UPDATED_BY],
        )
      } else {
        await pool.query(`DELETE FROM platform_settings WHERE id = 'ai'`)
      }
      invalidateNamespace('ai')
      ok('restored prior ai row', true)
    } else {
      console.log('  ℹ️  --keep: smoke ai row retained')
    }
  } catch (error) {
    fail++
    console.error('  ❌ smoke failed:', error)
  } finally {
    await pool.end()
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main()
