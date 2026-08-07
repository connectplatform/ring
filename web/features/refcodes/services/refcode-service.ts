import { randomBytes } from 'crypto'
import { db } from '@/lib/database'
import type { RefcodeRecord, ResolvedRefcode } from '@/features/refcodes/types'
import { REFCODE_COLLECTION } from '@/features/refcodes/constants'
import { visitStatsFromDoc } from '@/features/refcodes/lib/visit-analytics'
import { getWalletAddressesForUser } from '@/features/refcodes/lib/user-wallets'
import { normalizeReferralUsername } from '@/features/refcodes/lib/referral-share-url'

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const CODE_LENGTH = 8

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return code
}

function normalizeWallet(address: string): string {
  return address.toLowerCase()
}

function usernameWalletSentinel(username: string): string {
  return `username:${username}`
}

function enrichRefcode(doc: RefcodeRecord): RefcodeRecord {
  return {
    ...doc,
    visitStats: visitStatsFromDoc(doc as unknown as Record<string, unknown>),
  }
}

async function codeExists(code: string): Promise<boolean> {
  const result = await db().findDocById<RefcodeRecord>(REFCODE_COLLECTION, code)
  return Boolean(result.success && result.data)
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode()
    if (!(await codeExists(code))) return code
  }
  throw new Error('Failed to generate unique referral code')
}

function toResolved(data: RefcodeRecord, fallbackCode: string): ResolvedRefcode {
  return {
    code: data.code || fallbackCode,
    ownerUserId: data.ownerUserId,
    walletAddress: data.walletAddress,
    kind: data.kind,
    username: data.username,
  }
}

export const RefcodeService = {
  async getOrCreateForWallet(userId: string, walletAddress: string): Promise<RefcodeRecord> {
    if (!walletAddress) throw new Error('Wallet address required')

    const normalized = normalizeWallet(walletAddress)

    const existing = await db().queryDocs<RefcodeRecord & { id: string }>({
      collection: REFCODE_COLLECTION,
      filters: [
        { field: 'ownerUserId', operator: '=', value: userId },
        { field: 'walletAddress', operator: '=', value: normalized },
      ],
      pagination: { limit: 1 },
    })

    if (existing.success && existing.data.length) {
      const doc = existing.data[0]
      return enrichRefcode({ ...doc, code: doc.code || doc.id, kind: doc.kind || 'wallet' })
    }

    const code = await uniqueCode()
    const now = new Date().toISOString()
    const record: RefcodeRecord = {
      code,
      ownerUserId: userId,
      walletAddress: normalized,
      active: true,
      createdAt: now,
      kind: 'wallet',
    }

    const created = await db().createDoc(REFCODE_COLLECTION, record, { id: code })
    if (!created.success) throw created.error || new Error('Failed to create refcode')
    return enrichRefcode(record)
  },

  /**
   * Primary share tag: refcode id === lowercase username.
   * Ensures every named user has a trackable tag without requiring a wallet.
   */
  async getOrCreateForUsername(userId: string, usernameRaw: string): Promise<RefcodeRecord> {
    const username = normalizeReferralUsername(usernameRaw)
    if (!username) throw new Error('Valid username required')

    const existing = await db().findDocById<RefcodeRecord>(REFCODE_COLLECTION, username)
    if (existing.success && existing.data) {
      const doc = existing.data
      if (doc.ownerUserId !== userId) {
        throw new Error('Username referral tag owned by another user')
      }
      return enrichRefcode({
        ...doc,
        code: doc.code || username,
        kind: 'username',
        username,
      })
    }

    const byOwner = await db().queryDocs<RefcodeRecord & { id: string }>({
      collection: REFCODE_COLLECTION,
      filters: [
        { field: 'ownerUserId', operator: '=', value: userId },
        { field: 'kind', operator: '=', value: 'username' },
      ],
      pagination: { limit: 1 },
    })
    if (byOwner.success && byOwner.data.length) {
      const doc = byOwner.data[0]
      return enrichRefcode({
        ...doc,
        code: doc.code || doc.id,
        kind: 'username',
        username: doc.username || username,
      })
    }

    const now = new Date().toISOString()
    const record: RefcodeRecord = {
      code: username,
      ownerUserId: userId,
      walletAddress: usernameWalletSentinel(username),
      active: true,
      createdAt: now,
      kind: 'username',
      username,
    }

    const created = await db().createDoc(REFCODE_COLLECTION, record, { id: username })
    if (!created.success) throw created.error || new Error('Failed to create username refcode')
    return enrichRefcode(record)
  },

  async listForUser(userId: string, username?: string | null): Promise<RefcodeRecord[]> {
    const records: RefcodeRecord[] = []
    const seen = new Set<string>()

    const pushUnique = (rec: RefcodeRecord) => {
      if (seen.has(rec.code)) return
      seen.add(rec.code)
      records.push(rec)
    }

    if (username) {
      try {
        pushUnique(await this.getOrCreateForUsername(userId, username))
      } catch {
        /* username tag optional if validation fails */
      }
    }

    const addresses = await getWalletAddressesForUser(userId)
    for (const address of addresses) {
      if (!address) continue
      try {
        pushUnique(await this.getOrCreateForWallet(userId, address))
      } catch {
        /* skip invalid wallet */
      }
    }

    return records
  },

  async resolveCode(code: string): Promise<ResolvedRefcode | null> {
    const raw = code?.trim()
    if (!raw || raw.length < 3) return null

    const byId = await db().findDocById<RefcodeRecord>(REFCODE_COLLECTION, raw)
    if (byId.success && byId.data && byId.data.active !== false) {
      return toResolved(byId.data, raw)
    }

    const username = normalizeReferralUsername(raw)
    if (!username) return null

    const byUsernameId = await db().findDocById<RefcodeRecord>(REFCODE_COLLECTION, username)
    if (byUsernameId.success && byUsernameId.data && byUsernameId.data.active !== false) {
      return toResolved(byUsernameId.data, username)
    }

    // Lazy: resolve live username → ensure tag exists for that owner
    const { getUserByUsername } = await import(
      '@/features/auth/services/get-user-by-username'
    )
    const user = await getUserByUsername(username)
    if (!user?.id || !user.username) return null

    try {
      const ensured = await this.getOrCreateForUsername(user.id, user.username)
      if (ensured.active === false) return null
      return toResolved(ensured, ensured.code)
    } catch {
      return null
    }
  },
}
