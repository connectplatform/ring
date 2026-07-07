import 'server-only'

import type { Pool } from 'pg'
import { getDatabaseService, initializeDatabase } from './DatabaseService'

/**
 * Sanctioned escape hatch for raw SQL that the doc-model cannot express (PostGIS).
 * Returns the connected PostgreSQLAdapter pool after initializeDatabase().
 *
 * `new Pool(` is allowed only under lib/database/ — use this instead of private pools.
 */
export async function getSharedPgPool(): Promise<Pool> {
  const init = await initializeDatabase()
  if (!init.success) {
    throw init.error ?? new Error('Database initialization failed')
  }
  return getDatabaseService().getPostgreSQLPool()
}
