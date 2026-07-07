import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { Pool } from 'pg'
import { initializeDatabase } from '@/lib/database'
import { getTokenDeskConfig } from '@/lib/ring-config-chain'

// Namespace for web3-related platform settings
const WEB3_NAMESPACE = 'web3'

// Default rate (RING tokens per 1 USD) if not configured explicitly
const DEFAULT_RING_PER_USD = process.env.RING_ORACLE_DEFAULT_RATE ?? '100'

// Maximum allowed deviation between old and new rates in basis points (0.01% units)
const MAX_DEVIATION_BPS = 500

// Singleton Postgres pool for re-use across the module (avoid excessive connections)
let pool: Pool | null = null

/**
 * Lazy-initialize and return Postgres pool.
 * Throws if DATABASE_URL is not defined in environment.
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      // Fail fast if DB URL is missing
      throw new Error('DATABASE_URL is not configured')
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

/**
 * Return the desk quote signing secret.
 * Throws if both env variables are missing.
 */
function quoteSecret(): string {
  const secret = process.env.ORACLE_QUOTE_SECRET || process.env.WALLET_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('ORACLE_QUOTE_SECRET or WALLET_ENCRYPTION_KEY required for desk quotes')
  }
  return secret
}

// Shape of DB settings for oracle and its audit log
type OracleData = {
  oracle?: {
    ringPerUsd?: string // how many RING to $1
    updatedAt?: string // ISO timestamp of last update
    updatedBy?: string // who updated last
  }
  audit?: Array<{
    at: string        // ISO timestamp for the change
    by: string        // who made the change
    oldRate?: string  // previous rate
    newRate: string   // new rate
  }>
}

/**
 * Read the web3 settings for the oracle.
 * If DB is disabled, return default.
 */
async function readWeb3Settings(): Promise<OracleData> {
  // If DB is disabled, short-circuit with default rate
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    return { oracle: { ringPerUsd: DEFAULT_RING_PER_USD } }
  }

  // Ensure DB is initialized (migrations, etc)
  await initializeDatabase()

  // Get a client from the pool and query platform_settings
  const client = await getPool().connect()
  try {
    const result = await client.query(
      `SELECT data FROM platform_settings WHERE id = $1`, [WEB3_NAMESPACE]
    )
    if (!result.rows.length) {
      // No existing data, fallback to default
      return { oracle: { ringPerUsd: DEFAULT_RING_PER_USD } }
    }
    // Return parsed DB data (may be partial)
    const data = result.rows[0].data as OracleData
    return data ?? {}
  } finally {
    client.release() // Always release the client!
  }
}

/**
 * Write the oracle rate & audit data to the DB.
 * Throws if DB writes are disabled.
 */
async function writeWeb3Settings(data: OracleData, updatedBy: string): Promise<void> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    throw new Error('Platform settings DB writes are disabled')
  }

  await initializeDatabase()
  const client = await getPool().connect()
  try {
    // Upsert the row for the WEB3_NAMESPACE setting.
    await client.query(
      `INSERT INTO platform_settings (id, data, secrets, updated_by, created_at, updated_at)
       VALUES ($1, $2::jsonb, '{}'::jsonb, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         data = EXCLUDED.data,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [WEB3_NAMESPACE, JSON.stringify(data), updatedBy],
    )
  } finally {
    client.release()
  }
}

/**
 * Get the current oracle exchange rate (as string).
 * Returns the DB value if present, else the default.
 */
export async function getRingPerUsdRate(): Promise<string> {
  const settings = await readWeb3Settings()
  return settings.oracle?.ringPerUsd ?? DEFAULT_RING_PER_USD
}

/**
 * Set a new oracle exchange rate, enforcing positive number and max deviation.
 * Records history in audit log, and writes data to DB.
 * Returns updated rate.
 */
export async function setRingPerUsdRate(
  newRate: string,
  updatedBy: string,
): Promise<{ ringPerUsd: string }> {
  const parsed = parseFloat(newRate)
  // Validate the rate is a positive float
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Oracle rate must be a positive number')
  }

  // Fetch current settings
  const settings = await readWeb3Settings()
  const oldRate = settings.oracle?.ringPerUsd ?? DEFAULT_RING_PER_USD
  const oldNum = parseFloat(oldRate)
  if (oldNum > 0) {
    // Compute the absolute deviation in BPS (1 bps = 0.01%)
    const deviationBps = Math.abs((parsed - oldNum) / oldNum) * 10_000
    if (deviationBps > MAX_DEVIATION_BPS) {
      throw new Error(`Rate change exceeds max deviation (${MAX_DEVIATION_BPS} bps)`)
    }
  }

  // Prepare updated oracle data and truncate audit to last 49 entries
  const now = new Date().toISOString()
  const next: OracleData = {
    ...settings,
    oracle: { ringPerUsd: newRate, updatedAt: now, updatedBy },
    audit: [
      ...(settings.audit ?? []).slice(-49), // keep last 49
      { at: now, by: updatedBy, oldRate, newRate },
    ],
  }

  // Write to settings and return current rate
  await writeWeb3Settings(next, updatedBy)
  return { ringPerUsd: newRate }
}

/**
 * Fetch the audit log of oracle rate changes.
 */
export async function getOracleAuditLog() {
  const settings = await readWeb3Settings()
  return settings.audit ?? [] // Never return undefined, always []
}

// Structure of a signed quote for buy/sell RING tokens
export type SignedQuotePayload = {
  side: 'buy' | 'sell'
  ringAmountRaw: string      // Amount of ring tokens (raw, as string for precision)
  creditUsd: string          // USD value (string for adequacy in JS)
  rate: string               // Applied rate at time of quote
  discountBps: number        // Discount (positive or negative) in basis points
  expiresAt: number          // Epoch ms timestamp, quote expiry
}

/**
 * Encodes a SignedQuotePayload to a base64url-encoded JSON string.
 * This is used as the "body" of a quote token.
 */
function encodeQuote(payload: SignedQuotePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

/**
 * Decodes the body of a quote token (before dot) into SignedQuotePayload.
 */
function decodeQuote(token: string): SignedQuotePayload {
  const json = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')
  return JSON.parse(json) as SignedQuotePayload
}

/**
 * Returns a signed quote as a token.
 * Payload is base64url-encoded and HMAC-signed with secret.
 * Optionally accepts custom expiry (expiresAt, ms epoch time).
 */
export function signQuote(payload: Omit<SignedQuotePayload, 'expiresAt'> & { expiresAt?: number }) {
  const desk = getTokenDeskConfig()
  // TODO: In React19/Next16, consider using new config conventions for runtime config if available
  // Use quoteTtlSeconds, fallback to 60 seconds if not defined
  const ttlSeconds = (desk.quoteTtlSeconds ?? 60) as number // TODO: Fix type error by improving config typing
  const full: SignedQuotePayload = {
    ...payload,
    expiresAt: payload.expiresAt ?? (Date.now() + ttlSeconds * 1000),
  }
  const body = encodeQuote(full)
  // HMAC for integrity/signature
  const sig = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

/**
 * Verifies a signed quote token's integrity, signature, and expiry.
 * Returns decoded signed payload if valid, else throws.
 */
export function verifyQuoteToken(quoteToken: string): SignedQuotePayload {
  const [body, sig] = quoteToken.split('.')
  if (!body || !sig) {
    throw new Error('Invalid quote token')
  }

  // Compute expected signature for body
  const expected = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // Use timingSafeEqual to avoid timing attacks
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Quote signature mismatch')
  }

  // Decode and verify expiry
  const payload = decodeQuote(quoteToken)
  if (Date.now() > payload.expiresAt) {
    throw new Error('Quote expired')
  }

  return payload
}

/**
 * Throws if quoted rate deviates excessively from current oracle live rate.
 * Used to prevent stale or mispriced quotes being accepted in transactions.
 */
export async function assertQuoteSlippage(payload: SignedQuotePayload): Promise<void> {
  const desk = getTokenDeskConfig()
  // TODO: Fix typing in config so maxSlippageBps is always a number.
  const maxSlippageBps = (desk.maxSlippageBps ?? 100) as number
  // Get live oracle rate (string), parse as float
  const liveRate = parseFloat(await getRingPerUsdRate())
  const quotedRate = parseFloat(payload.rate)
  // If either rate is zero/invalid, abort silently
  if (!liveRate || !quotedRate) return

  // Compute deviation in basis points (bps)
  const deviationBps = (Math.abs(liveRate - quotedRate) / liveRate) * 10_000
  if (deviationBps > maxSlippageBps) {
    throw new Error('Oracle rate moved beyond slippage tolerance — request a new quote')
  }
}

// TODO: This service could benefit from Typed Next.js Config for static/server/runtime env vars in Next16+
// TODO: Can migrate DB access to use Next.js or custom React Server Actions (RSC) if write paths need to be trivially called from server components.
// TODO: If/when platform_settings becomes a React context or provider, use use optimisitic updates in UI via React19 actions/suspense.