#!/usr/bin/env node
/**
 * Desk reconciliation stub — poll chain_submitted orders older than N minutes.
 * Phase 2: logs stale orders; full on-chain confirmation wiring in Phase 2.5.
 */
import { Pool } from 'pg'

const STALE_MINUTES = Number(process.env.DESK_RECONCILE_STALE_MINUTES ?? 15)

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, data->>'status' AS status, data->>'user_id' AS user_id, updated_at
       FROM desk_orders
       WHERE data->>'status' = 'chain_submitted'
         AND updated_at < NOW() - ($1 || ' minutes')::interval`,
      [String(STALE_MINUTES)],
    )

    if (!result.rows.length) {
      console.log('No stale desk orders')
      return
    }

    console.log(`Found ${result.rows.length} stale chain_submitted desk order(s):`)
    for (const row of result.rows) {
      console.log(`  ${row.id} user=${row.user_id} updated=${row.updated_at}`)
    }
    console.log('Manual review or Phase 2.5 auto-confirm required.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
