/**
 * Smoke: user identity — no duplicate emails after dedupe + unique index.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/smoke-user-identity.cts
 */

import { Pool } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform'

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
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    console.log('smoke-user-identity')

    const dupes = await pool.query<{ email: string; count: string }>(`
      SELECT lower(data->>'email') AS email, count(*)::text AS count
      FROM users
      WHERE data->>'email' IS NOT NULL AND btrim(data->>'email') <> ''
      GROUP BY lower(data->>'email')
      HAVING count(*) > 1
      ORDER BY count(*)::int DESC
      LIMIT 20
    `)

    ok('no duplicate user emails', dupes.rows.length === 0, dupes.rows.map((r) => `${r.email}(${r.count})`).join(', '))

    const uniqueIndex = await pool.query(`
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'idx_users_email_unique_lower'
    `)
    ok('unique email index exists', uniqueIndex.rows.length === 1)

    const automart = await pool.query(`
      SELECT count(*)::text AS count FROM users WHERE lower(data->>'email') = 'automart@gmail.com'
    `)
    ok('automart@gmail.com has at most one row', Number(automart.rows[0]?.count ?? 0) <= 1, `count=${automart.rows[0]?.count}`)

    const accounts = await pool.query(`
      SELECT count(*)::text AS count
      FROM accounts a
      JOIN users u ON u.id = a.data->>'userId'
      WHERE lower(u.data->>'email') = 'automart@gmail.com' AND a.data->>'provider' = 'google'
    `)
    ok('automart has linked google account when user exists', Number(automart.rows[0]?.count ?? 0) === 0 || Number(accounts.rows[0]?.count ?? 0) >= 1)

    console.log(`\n${pass} passed, ${fail} failed`)
    if (fail > 0) process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
