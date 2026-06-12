import { randomBytes } from 'crypto'
import { db } from '@/lib/database'
import type { RefcodeRecord, ResolvedRefcode } from '@/features/refcodes/types'
import { REFCODE_COLLECTION } from '@/features/refcodes/constants'
import { visitStatsFromDoc } from '@/features/refcodes/lib/visit-analytics'
import { getWalletAddressesForUser } from '@/features/refcodes/lib/user-wallets'

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
      return enrichRefcode({ ...doc, code: doc.code || doc.id })
    }

    const code = await uniqueCode()
    const now = new Date().toISOString()
    const record: RefcodeRecord = {
      code,
      ownerUserId: userId,
      walletAddress: normalized,
      active: true,
      createdAt: now,
    }

    const created = await db().createDoc(REFCODE_COLLECTION, record, { id: code })
    if (!created.success) throw created.error || new Error('Failed to create refcode')
    return enrichRefcode(record)
  },

  async listForUser(userId: string): Promise<RefcodeRecord[]> {
    const addresses = await getWalletAddressesForUser(userId)
    const records: RefcodeRecord[] = []

    for (const address of addresses) {
      if (!address) continue
      try {
        records.push(await this.getOrCreateForWallet(userId, address))
      } catch {
        /* skip invalid wallet */
      }
    }

    return records
  },

  async resolveCode(code: string): Promise<ResolvedRefcode | null> {
    if (!code || code.length < 4) return null

    const result = await db().findDocById<RefcodeRecord>(REFCODE_COLLECTION, code.trim())
    if (!result.success || !result.data) return null

    const data = result.data
    if (data.active === false) return null

    return {
      code: data.code || code,
      ownerUserId: data.ownerUserId,
      walletAddress: data.walletAddress,
    }
  },
}
