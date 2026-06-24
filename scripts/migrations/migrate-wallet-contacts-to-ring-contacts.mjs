#!/usr/bin/env node
/**
 * Migrate project_wallet_contacts → ring_contacts.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrations/migrate-wallet-contacts-to-ring-contacts.mjs
 *   DATABASE_URL=... node scripts/migrations/migrate-wallet-contacts-to-ring-contacts.mjs --dry-run
 *
 * Orphans (address-only rows with no matching users.wallets[] owner) are logged, never inserted.
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes('--dry-run')
const reportPath = resolve(__dirname, 'migration-report.json')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl })

async function findUserIdByWalletAddress(address) {
  const normalized = address.toLowerCase()
  const { rows } = await client.query(
    `SELECT id FROM users
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(data->'wallets') AS w
       WHERE lower(w->>'address') = $1
     )
     LIMIT 1`,
    [normalized],
  )
  return rows[0]?.id ?? null
}

async function loadUserProfile(userId) {
  const { rows } = await client.query(`SELECT data FROM users WHERE id = $1`, [userId])
  if (!rows.length) return null
  return rows[0].data ?? {}
}

async function ringContactExists(ownerUserId, projectSlug, contactUserId) {
  const { rows } = await client.query(
    `SELECT id FROM ring_contacts
     WHERE data->>'owner_user_id' = $1
       AND data->>'project_slug' = $2
       AND data->>'contact_user_id' = $3
     LIMIT 1`,
    [ownerUserId, projectSlug, contactUserId],
  )
  return rows.length > 0
}

async function insertRingContact(row) {
  const id = crypto.randomUUID()
  await client.query(
    `INSERT INTO ring_contacts (id, data, created_at, updated_at)
     VALUES ($1, $2::jsonb, NOW(), NOW())`,
    [id, JSON.stringify(row)],
  )
  return id
}

async function main() {
  await client.connect()

  const report = {
    dryRun,
    migrated: [],
    skippedDuplicate: [],
    orphans: [],
    errors: [],
    startedAt: new Date().toISOString(),
  }

  const { rows: legacyRows } = await client.query(
    `SELECT id, data FROM project_wallet_contacts ORDER BY created_at ASC`,
  )

  console.log(`Found ${legacyRows.length} legacy project_wallet_contacts rows`)

  for (const legacy of legacyRows) {
    const data = legacy.data ?? {}
    const ownerUserId = data.global_user_id ?? data.globalUserId
    const projectSlug = data.project_slug ?? data.projectSlug
    const legacyAddress = (data.address ?? '').trim()
    const legacyName = data.name ?? data.display_name ?? 'Contact'

    if (!ownerUserId || !projectSlug) {
      report.errors.push({ legacyId: legacy.id, reason: 'missing owner or project_slug' })
      continue
    }

    let contactUserId =
      data.contact_user_id ?? data.contactUserId ?? null

    if (!contactUserId && legacyAddress) {
      contactUserId = await findUserIdByWalletAddress(legacyAddress)
    }

    if (!contactUserId) {
      report.orphans.push({
        legacyId: legacy.id,
        ownerUserId,
        projectSlug,
        name: legacyName,
        address: legacyAddress,
      })
      continue
    }

    if (contactUserId === ownerUserId) {
      report.skippedDuplicate.push({ legacyId: legacy.id, reason: 'self-contact' })
      continue
    }

    if (await ringContactExists(ownerUserId, projectSlug, contactUserId)) {
      report.skippedDuplicate.push({
        legacyId: legacy.id,
        ownerUserId,
        contactUserId,
        reason: 'already exists',
      })
      continue
    }

    const profile = await loadUserProfile(contactUserId)
    const ringRow = {
      owner_user_id: ownerUserId,
      project_slug: projectSlug,
      contact_user_id: contactUserId,
      display_name: profile.name ?? profile.displayName ?? legacyName,
      username: profile.username ?? null,
      photo_url: profile.photoURL ?? profile.photo_url ?? null,
      wallet_address: legacyAddress || null,
      notes: data.notes ?? data.note ?? undefined,
      is_favorite: data.is_favorite ?? data.isFavorite ?? false,
      added_at: data.added_at ?? data.addedAt ?? new Date().toISOString(),
      last_used: data.last_used ?? data.lastUsed ?? null,
    }

    if (!dryRun) {
      const newId = await insertRingContact(ringRow)
      report.migrated.push({ legacyId: legacy.id, newId, contactUserId })
    } else {
      report.migrated.push({ legacyId: legacy.id, contactUserId, dryRun: true })
    }
  }

  report.completedAt = new Date().toISOString()
  report.summary = {
    migrated: report.migrated.length,
    orphans: report.orphans.length,
    skippedDuplicate: report.skippedDuplicate.length,
    errors: report.errors.length,
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`Report written to ${reportPath}`)

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
