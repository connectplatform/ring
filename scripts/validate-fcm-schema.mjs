#!/usr/bin/env node
/**
 * Verify fcm_tokens table uses JSONB `data` column (migration 016).
 *
 * Usage:
 *   node scripts/validate-fcm-schema.mjs
 *   DATABASE_URL=postgresql://... node scripts/validate-fcm-schema.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const ROOT = path.resolve(import.meta.dirname, '..')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim()
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('DATABASE_URL=')) {
      return trimmed.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

async function main() {
  const databaseUrl = loadDatabaseUrl()
  if (!databaseUrl) {
    console.error('FAIL  DATABASE_URL not set (env or .env.local)')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const table = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fcm_tokens'`,
    )
    if (table.rowCount === 0) {
      console.error('FAIL  fcm_tokens table missing — apply data/schema.sql then 016_fcm_jsonb_schema.sql')
      process.exit(1)
    }

    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'fcm_tokens'`,
    )
    const names = new Set(cols.rows.map((r) => r.column_name))

    if (!names.has('data')) {
      console.error('FAIL  fcm_tokens missing JSONB data column (legacy relational schema)')
      console.error('      Fix: psql "$DATABASE_URL" -f data/migrations/016_fcm_jsonb_schema.sql')
      process.exit(1)
    }

    if (names.has('user_id') && !names.has('data')) {
      console.error('FAIL  legacy fcm_tokens columns detected without data JSONB')
      process.exit(1)
    }

    const version = await client.query(
      `SELECT version FROM schema_versions WHERE version = '4.0.3-fcm-jsonb' LIMIT 1`,
    )
    const migrated = version.rowCount > 0

    console.log('OK    fcm_tokens JSONB schema (data column present)')
    if (!migrated) {
      console.log('WARN  schema_versions missing 4.0.3-fcm-jsonb — re-run 016_fcm_jsonb_schema.sql to record version')
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('FAIL ', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
