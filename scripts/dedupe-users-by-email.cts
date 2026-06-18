/**
 * Dedupe users rows that share the same email (case-insensitive).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/dedupe-users-by-email.cts [--email user@example.com] [--apply]
 *
 * Default is dry-run. Use --apply to execute merges and deletes.
 */

import { Pool } from 'pg'
import {
  normalizeAuthEmail,
  pickCanonicalUserFromDuplicates,
  type UserRow,
} from '../features/auth/services/user-resolve'

const APPLY = process.argv.includes('--apply')
const emailArg = (() => {
  const idx = process.argv.indexOf('--email')
  if (idx === -1) return null
  return process.argv[idx + 1] ?? null
})()

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform'

type DuplicateGroup = {
  email: string
  rows: Array<UserRow & { created_at?: Date }>
}

const JSONB_USER_ID_FIELDS = [
  'userId',
  'user_id',
  'createdBy',
  'applicantUserId',
  'reviewedBy',
  'ownerId',
  'authorId',
  'assignedTo',
]

const JSONB_TABLES = [
  'accounts',
  'sessions',
  'entities',
  'opportunities',
  'orders',
  'store_orders',
  'notifications',
  'notification_preferences',
  'verification_procedures',
  'vendor_profiles',
  'vendor_applications',
  'conversations',
  'messages',
  'comments',
  'likes',
  'news_likes',
  'comment_likes',
  'payment_transactions',
  'payments',
  'referral_rewards',
  'generated_images',
  'matcher_moderation_events',
  'matcher_verification_events',
]

const COLUMN_USER_ID_TABLES: Array<{ table: string; column: string }> = [
  { table: 'fcm_tokens', column: 'user_id' },
  { table: 'telegram_admin_audit', column: 'user_id' },
]

async function loadDuplicateGroups(pool: Pool): Promise<DuplicateGroup[]> {
  const params: string[] = []
  let filter = ''
  if (emailArg) {
    filter = 'WHERE lower(data->>\'email\') = $1'
    params.push(normalizeAuthEmail(emailArg))
  }

  const { rows } = await pool.query<{
    email: string
    ids: string[]
    count: string
  }>(
    `
    SELECT lower(data->>'email') AS email,
           array_agg(id ORDER BY created_at ASC) AS ids,
           count(*)::text AS count
    FROM users
    ${filter}
    GROUP BY lower(data->>'email')
    HAVING count(*) > 1
    ORDER BY email
    `,
    params
  )

  const groups: DuplicateGroup[] = []
  for (const group of rows) {
    const userRows = await pool.query<{
      id: string
      data: Record<string, unknown>
      created_at: Date
    }>(
      `SELECT id, data, created_at FROM users WHERE id = ANY($1::varchar[]) ORDER BY created_at ASC`,
      [group.ids]
    )

    groups.push({
      email: group.email,
      rows: userRows.rows.map((row) => ({
        id: row.id,
        ...row.data,
        createdAt: row.data.createdAt ?? row.created_at,
        created_at: row.created_at,
      })) as Array<UserRow & { created_at?: Date }>,
    })
  }

  return groups
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  )
  return result.rows.length > 0
}

async function repointJsonbTable(
  pool: Pool,
  table: string,
  field: string,
  duplicateId: string,
  canonicalId: string
): Promise<number> {
  if (!(await tableExists(pool, table))) return 0

  const sql = `
    UPDATE ${table}
    SET data = jsonb_set(data, '{${field}}', to_jsonb($2::text), true),
        updated_at = NOW()
    WHERE data->>'${field}' = $1
  `
  try {
    const result = await pool.query(sql, [duplicateId, canonicalId])
    return result.rowCount ?? 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('does not exist')) return 0
    throw error
  }
}

async function mergeWallets(
  pool: Pool,
  canonicalId: string,
  duplicateId: string
): Promise<void> {
  const { rows } = await pool.query<{ data: { wallets?: Array<{ address?: string }> } }>(
    `SELECT data FROM users WHERE id = ANY($1::varchar[])`,
    [[canonicalId, duplicateId]]
  )

  const walletsByAddress = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const wallets = row.data?.wallets
    if (!Array.isArray(wallets)) continue
    for (const wallet of wallets) {
      const address = wallet?.address
      if (address) walletsByAddress.set(address, wallet as Record<string, unknown>)
    }
  }

  await pool.query(
    `
    UPDATE users
    SET data = jsonb_set(data, '{wallets}', $2::jsonb, true),
        updated_at = NOW()
    WHERE id = $1
    `,
    [canonicalId, JSON.stringify([...walletsByAddress.values()])]
  )
}

async function dedupeGroup(
  pool: Pool,
  group: DuplicateGroup
): Promise<{ canonicalId: string; deleted: string[]; updates: number }> {
  const linkedIds = new Set<string>()
  const accountRows = await pool.query<{ user_id: string }>(
    `SELECT data->>'userId' AS user_id FROM accounts WHERE data->>'userId' = ANY($1::text[])`,
    [group.rows.map((r) => r.id)]
  )
  for (const row of accountRows.rows) {
    if (row.user_id) linkedIds.add(row.user_id)
  }

  const canonical = await pickCanonicalUserFromDuplicates(group.rows, linkedIds)
  const canonicalId = canonical.id
  const duplicates = group.rows.map((r) => r.id).filter((id) => id !== canonicalId)

  console.log(`\nEmail: ${group.email}`)
  console.log(`  Canonical: ${canonicalId} (role=${canonical.role}, username=${canonical.username ?? '—'})`)
  console.log(`  Duplicates: ${duplicates.join(', ') || 'none'}`)

  let updates = 0

  for (const duplicateId of duplicates) {
    for (const table of JSONB_TABLES) {
      for (const field of JSONB_USER_ID_FIELDS) {
        const count = await repointJsonbTable(pool, table, field, duplicateId, canonicalId)
        if (count > 0) {
          console.log(`  ${APPLY ? 'UPDATE' : 'DRY'} ${table}.${field}: ${count} rows ${duplicateId} → ${canonicalId}`)
          updates += count
        }
      }
    }

    for (const { table, column } of COLUMN_USER_ID_TABLES) {
      if (!(await tableExists(pool, table))) continue
      const sql = `UPDATE ${table} SET ${column} = $2 WHERE ${column} = $1`
      const result = await pool.query(sql, [duplicateId, canonicalId])
      const count = result.rowCount ?? 0
      if (count > 0) {
        console.log(`  ${APPLY ? 'UPDATE' : 'DRY'} ${table}.${column}: ${count} rows`)
        updates += count
      }
    }

    if (APPLY) {
      await mergeWallets(pool, canonicalId, duplicateId)
      await pool.query(`DELETE FROM users WHERE id = $1`, [duplicateId])
      console.log(`  DELETED user ${duplicateId}`)
    } else {
      console.log(`  DRY DELETE user ${duplicateId}`)
    }
  }

  if (APPLY && duplicates.length > 0) {
    await pool.query(
      `
      UPDATE users
      SET data = jsonb_set(
        jsonb_set(data, '{email}', to_jsonb($2::text), true),
        '{id}', to_jsonb($1::text), true
      ),
      updated_at = NOW()
      WHERE id = $1
      `,
      [canonicalId, normalizeAuthEmail(group.email)]
    )
  }

  return { canonicalId, deleted: duplicates, updates }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })
  try {
    console.log(`User dedupe — mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
    if (emailArg) console.log(`Filter email: ${normalizeAuthEmail(emailArg)}`)

    const groups = await loadDuplicateGroups(pool)
    if (groups.length === 0) {
      console.log('No duplicate email groups found.')
      return
    }

    console.log(`Found ${groups.length} duplicate email group(s).`)

    let totalDeleted = 0
    for (const group of groups) {
      const result = await dedupeGroup(pool, group)
      totalDeleted += result.deleted.length
    }

    console.log(`\nDone. ${APPLY ? 'Deleted' : 'Would delete'} ${totalDeleted} duplicate user row(s).`)
    if (!APPLY) {
      console.log('Re-run with --apply to execute changes.')
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
