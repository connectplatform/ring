import type { PaymentPurpose } from '@/lib/payments/conductor/types'

export function encodeArticleIdForOrder(articleId: string): string {
  return Buffer.from(articleId, 'utf8').toString('base64url')
}

export function decodeArticleIdFromOrderReference(orderReference: string): string | null {
  const match = orderReference.match(/^news-promo-([A-Za-z0-9_-]+)-\d+$/)
  if (!match) return null
  try {
    return Buffer.from(match[1], 'base64url').toString('utf8')
  } catch {
    return null
  }
}

export interface ParsedOrderReference {
  purpose: PaymentPurpose
  entityId: string
  userId?: string
  timestamp?: number
}

export function buildOrderReference(
  purpose: PaymentPurpose,
  payload: { orderId?: string; userId?: string; articleId?: string }
): string {
  const ts = Date.now()
  switch (purpose) {
    case 'store_order':
      if (!payload.orderId) throw new Error('orderId required for store_order')
      return `store_${payload.orderId}_${ts}`
    case 'membership_upgrade':
      if (!payload.userId) throw new Error('userId required for membership_upgrade')
      return `membership_${payload.userId}_${ts}`
    case 'news_promotion':
      if (!payload.articleId) throw new Error('articleId required for news_promotion')
      return `news-promo-${encodeArticleIdForOrder(payload.articleId)}-${ts}`
    default:
      throw new Error(`Unsupported purpose for order reference: ${purpose}`)
  }
}

export function parseOrderReference(orderReference: string): ParsedOrderReference | null {
  const storeMatch = orderReference.match(/^store_([^_]+)_(\d+)$/)
  if (storeMatch) {
    return {
      purpose: 'store_order',
      entityId: storeMatch[1],
      timestamp: Number(storeMatch[2]),
    }
  }

  const membershipMatch = orderReference.match(/^membership_([^_]+)_(\d+)$/)
  if (membershipMatch) {
    return {
      purpose: 'membership_upgrade',
      entityId: membershipMatch[1],
      userId: membershipMatch[1],
      timestamp: Number(membershipMatch[2]),
    }
  }

  const legacyMembershipMatch = orderReference.match(/^ring_([^_]+)_(\d+)$/)
  if (legacyMembershipMatch) {
    return {
      purpose: 'membership_upgrade',
      entityId: legacyMembershipMatch[1],
      userId: legacyMembershipMatch[1],
      timestamp: Number(legacyMembershipMatch[2]),
    }
  }

  const articleId = decodeArticleIdFromOrderReference(orderReference)
  if (articleId) {
    const tsMatch = orderReference.match(/-(\d+)$/)
    return {
      purpose: 'news_promotion',
      entityId: articleId,
      timestamp: tsMatch ? Number(tsMatch[1]) : undefined,
    }
  }

  return null
}
