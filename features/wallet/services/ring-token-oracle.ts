import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { Pool } from 'pg'
import { initializeDatabase } from '@/lib/database'
import { getRingDeskConfig } from '@/lib/ring-config-chain'

const WEB3_NAMESPACE = 'web3'
const DEFAULT_RING_PER_USD = process.env.RING_ORACLE_DEFAULT_RATE ?? '100'
const MAX_DEVIATION_BPS = 500

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

function quoteSecret(): string {
  const secret = process.env.ORACLE_QUOTE_SECRET || process.env.WALLET_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('ORACLE_QUOTE_SECRET or WALLET_ENCRYPTION_KEY required for desk quotes')
  }
  return secret
}

type OracleData = {
  oracle?: {
    ringPerUsd?: string
    updatedAt?: string
    updatedBy?: string
  }
  audit?: Array<{
    at: string
    by: string
    oldRate?: string
    newRate: string
  }>
}

async function readWeb3Settings(): Promise<OracleData> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    return { oracle: { ringPerUsd: DEFAULT_RING_PER_USD } }
  }

  await initializeDatabase()
  const client = await getPool().connect()
  try {
    const result = await client.query(`SELECT data FROM platform_settings WHERE id = $1`, [
      WEB3_NAMESPACE,
    ])
    if (!result.rows.length) {
      return { oracle: { ringPerUsd: DEFAULT_RING_PER_USD } }
    }
    const data = result.rows[0].data as OracleData
    return data ?? {}
  } finally {
    client.release()
  }
}

async function writeWeb3Settings(data: OracleData, updatedBy: string): Promise<void> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    throw new Error('Platform settings DB writes are disabled')
  }

  await initializeDatabase()
  const client = await getPool().connect()
  try {
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

/** RING tokens per 1 USD fiat credit unit. */
export async function getRingPerUsdRate(): Promise<string> {
  const settings = await readWeb3Settings()
  return settings.oracle?.ringPerUsd ?? DEFAULT_RING_PER_USD
}

export async function setRingPerUsdRate(
  newRate: string,
  updatedBy: string,
): Promise<{ ringPerUsd: string }> {
  const parsed = parseFloat(newRate)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Oracle rate must be a positive number')
  }

  const settings = await readWeb3Settings()
  const oldRate = settings.oracle?.ringPerUsd ?? DEFAULT_RING_PER_USD
  const oldNum = parseFloat(oldRate)
  if (oldNum > 0) {
    const deviationBps = Math.abs((parsed - oldNum) / oldNum) * 10_000
    if (deviationBps > MAX_DEVIATION_BPS) {
      throw new Error(`Rate change exceeds max deviation (${MAX_DEVIATION_BPS} bps)`)
    }
  }

  const now = new Date().toISOString()
  const next: OracleData = {
    ...settings,
    oracle: { ringPerUsd: newRate, updatedAt: now, updatedBy },
    audit: [
      ...(settings.audit ?? []).slice(-49),
      { at: now, by: updatedBy, oldRate, newRate },
    ],
  }

  await writeWeb3Settings(next, updatedBy)
  return { ringPerUsd: newRate }
}

export async function getOracleAuditLog() {
  const settings = await readWeb3Settings()
  return settings.audit ?? []
}

export type SignedQuotePayload = {
  side: 'buy' | 'sell'
  ringAmountRaw: string
  creditUsd: string
  rate: string
  discountBps: number
  expiresAt: number
}

function encodeQuote(payload: SignedQuotePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeQuote(token: string): SignedQuotePayload {
  const json = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')
  return JSON.parse(json) as SignedQuotePayload
}

export function signQuote(payload: Omit<SignedQuotePayload, 'expiresAt'> & { expiresAt?: number }) {
  const desk = getRingDeskConfig()
  const ttlSeconds = desk.quoteTtlSeconds ?? 60
  const full: SignedQuotePayload = {
    ...payload,
    expiresAt: payload.expiresAt ?? Date.now() + ttlSeconds * 1000,
  }
  const body = encodeQuote(full)
  const sig = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyQuoteToken(quoteToken: string): SignedQuotePayload {
  const [body, sig] = quoteToken.split('.')
  if (!body || !sig) {
    throw new Error('Invalid quote token')
  }

  const expected = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Quote signature mismatch')
  }

  const payload = decodeQuote(quoteToken)
  if (Date.now() > payload.expiresAt) {
    throw new Error('Quote expired')
  }

  return payload
}

export async function assertQuoteSlippage(payload: SignedQuotePayload): Promise<void> {
  const desk = getRingDeskConfig()
  const maxSlippageBps = desk.maxSlippageBps ?? 100
  const liveRate = parseFloat(await getRingPerUsdRate())
  const quotedRate = parseFloat(payload.rate)
  if (!liveRate || !quotedRate) return

  const deviationBps = (Math.abs(liveRate - quotedRate) / liveRate) * 10_000
  if (deviationBps > maxSlippageBps) {
    throw new Error('Oracle rate moved beyond slippage tolerance — request a new quote')
  }
}
