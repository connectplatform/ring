import { db } from '@/lib/database'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import { getWalletAddressesForUser } from '@/features/refcodes/lib/user-wallets'
import type { OrderReferralAttribution } from '@/features/refcodes/types'
import { REFCODE_COLLECTION } from '@/features/refcodes/constants'
import { bumpVisitDaily } from '@/features/refcodes/lib/visit-analytics'

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'completed'] as const

export async function buyerHasPriorPaidOrder(userId: string): Promise<boolean> {
  for (const status of PAID_STATUSES) {
    const byStatus = await db().queryDocs({
      collection: 'orders',
      filters: [
        { field: 'userId', operator: '=', value: userId },
        { field: 'status', operator: '=', value: status },
      ],
      pagination: { limit: 1 },
    })
    if (byStatus.success && byStatus.data.length) return true
  }

  const byPayment = await db().queryDocs({
    collection: 'orders',
    filters: [
      { field: 'userId', operator: '=', value: userId },
      { field: 'payment.status', operator: '=', value: 'paid' },
    ],
    pagination: { limit: 1 },
  })
  if (byPayment.success && byPayment.data.length) return true

  return false
}

export async function resolveOrderReferral(
  buyerUserId: string,
  refCode: string | undefined,
  buyerWalletAddresses: string[] = []
): Promise<OrderReferralAttribution | null> {
  if (!refCode) return null

  const resolved = await RefcodeService.resolveCode(refCode)
  if (!resolved) return null

  if (resolved.ownerUserId === buyerUserId) return null

  const normalizedBuyerWallets = new Set(
    buyerWalletAddresses.filter(Boolean).map((a) => a.toLowerCase())
  )
  if (normalizedBuyerWallets.has(resolved.walletAddress.toLowerCase())) return null

  const hasPrior = await buyerHasPriorPaidOrder(buyerUserId)
  if (hasPrior) return null

  return {
    referralCode: resolved.code,
    referrerUserId: resolved.ownerUserId,
    referrerWallet: resolved.walletAddress,
  }
}

export async function getBuyerWalletAddresses(userId: string): Promise<string[]> {
  return getWalletAddressesForUser(userId)
}

/** Persist signup referral attribution from ring_ref cookie (first session only). */
export async function persistSignupReferralAttribution(
  userId: string,
  refCode: string,
): Promise<boolean> {
  if (!refCode?.trim()) return false

  const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
  if (!userResult.success || !userResult.data) return false

  const userData = userResult.data
  if (userData.referredBy) return false

  const resolved = await resolveOrderReferral(userId, refCode.trim(), [])
  if (!resolved?.referrerUserId) return false

  await db().updateDoc('users', userId, {
    referredBy: {
      referralCode: resolved.referralCode,
      referrerUserId: resolved.referrerUserId,
      referrerWallet: resolved.referrerWallet,
      attributedAt: new Date().toISOString(),
    },
  })

  return true
}

/** Increment visit counter on a refcode (beacon / track endpoint). */
export async function trackRefcodeVisit(code: string): Promise<{ ok: boolean; visits?: number }> {
  const normalized = code.trim()
  if (!normalized) return { ok: false }

  const read = await db().findDocById<Record<string, unknown>>(REFCODE_COLLECTION, normalized)
  if (!read.success || !read.data) return { ok: false }

  const doc = read.data
  const priorTotal = typeof doc.visits === 'number' ? doc.visits : 0
  const priorDaily = doc.visitDaily as Record<string, number> | undefined
  const { visits, visitDaily } = bumpVisitDaily(priorDaily, priorTotal)

  await db().updateDoc(REFCODE_COLLECTION, normalized, {
    visits,
    visitDaily,
    lastVisitAt: new Date().toISOString(),
  })

  return { ok: true, visits }
}
