#!/usr/bin/env node
/**
 * Audit users / accounts / sessions drift after Firebase → PostgreSQL migration.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/audit-auth-user-drift.mjs
 *   DATABASE_URL=postgres://... node scripts/audit-auth-user-drift.mjs --user-id <uuid>
 *   DATABASE_URL=postgres://... node scripts/audit-auth-user-drift.mjs --repair --dry-run
 */

import pg from 'pg'

const { Pool } = pg

const args = process.argv.slice(2)
const userIdFlag = args.indexOf('--user-id')
const targetUserId = userIdFlag >= 0 ? args[userIdFlag + 1] : null
const repair = args.includes('--repair')
const dryRun = !args.includes('--apply')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    console.log('=== Auth user drift audit ===\n')

    const orphans = await pool.query(`
      SELECT a.id, a.data->>'userId' AS user_id, a.data->>'provider' AS provider
      FROM accounts a
      LEFT JOIN users u ON u.id = a.data->>'userId'
      WHERE u.id IS NULL
      LIMIT 50
    `)
    console.log(`Orphan accounts (no matching users row): ${orphans.rowCount}`)
    for (const row of orphans.rows) {
      console.log(`  - account ${row.id} provider=${row.provider} userId=${row.user_id}`)
    }
    console.log()

    const dupes = await pool.query(`
      SELECT lower(data->>'email') AS email, count(*) AS cnt, array_agg(id) AS ids
      FROM users
      WHERE data->>'email' IS NOT NULL AND trim(data->>'email') <> ''
      GROUP BY 1
      HAVING count(*) > 1
      LIMIT 50
    `)
    console.log(`Duplicate user emails: ${dupes.rowCount}`)
    for (const row of dupes.rows) {
      console.log(`  - ${row.email}: ${row.cnt} ids=${JSON.stringify(row.ids)}`)
    }
    console.log()

    if (targetUserId) {
      const userRow = await pool.query(
        `SELECT id, data->>'email' AS email, data->>'account_status' AS account_status,
                data->>'accountStatus' AS account_status_camel
         FROM users WHERE id = $1`,
        [targetUserId],
      )
      const accountRows = await pool.query(
        `SELECT id, data->>'provider' AS provider, data->>'providerAccountId' AS provider_account_id
         FROM accounts WHERE data->>'userId' = $1`,
        [targetUserId],
      )
      const sessionRows = await pool.query(
        `SELECT id, data->>'sessionToken' IS NOT NULL AS has_token
         FROM sessions WHERE data->>'userId' = $1`,
        [targetUserId],
      )

      console.log(`Target user ${targetUserId}:`)
      console.log('  users:', userRow.rows[0] ?? 'NOT FOUND')
      console.log(`  accounts: ${accountRows.rowCount}`)
      for (const row of accountRows.rows) {
        console.log(`    - ${row.provider} (${row.provider_account_id})`)
      }
      console.log(`  sessions: ${sessionRows.rowCount}`)
      console.log()
    }

    if (repair && orphans.rowCount > 0) {
      console.log(dryRun ? 'DRY RUN repair suggestions:' : 'APPLYING repairs:')
      for (const row of orphans.rows) {
        const emailResult = await pool.query(
          `SELECT data->>'email' AS email FROM accounts WHERE id = $1`,
          [row.id],
        )
        const email = emailResult.rows[0]?.email
        if (!email) {
          console.log(`  skip account ${row.id} — no email on account row`)
          continue
        }
        const canonical = await pool.query(
          `SELECT id FROM users WHERE lower(data->>'email') = lower($1) ORDER BY created_at ASC LIMIT 1`,
          [email],
        )
        const canonicalId = canonical.rows[0]?.id
        if (!canonicalId) {
          console.log(`  skip account ${row.id} — no users row for email ${email}`)
          continue
        }
        console.log(`  relink account ${row.id}: ${row.user_id} → ${canonicalId}`)
        if (!dryRun) {
          await pool.query(
            `UPDATE accounts SET data = jsonb_set(data, '{userId}', to_jsonb($1::text)), updated_at = NOW() WHERE id = $2`,
            [canonicalId, row.id],
          )
        }
      }
    }

    const hasIssues = (orphans.rowCount ?? 0) > 0 || (dupes.rowCount ?? 0) > 0
    process.exit(hasIssues && !repair ? 1 : 0)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
