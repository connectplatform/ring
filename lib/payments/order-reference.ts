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
  payload: {
    orderId?: string
    userId?: string
    articleId?: string
    poolSlug?: string
  }
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
    case 'wallet_topup':
      if (!payload.userId) throw new Error('userId required for wallet_topup')
      return `wallettopup_${payload.userId}_${ts}`
    case 'native_token_onramp':
      if (!payload.userId) throw new Error('userId required for native_token_onramp')
      return `tokenonramp_${payload.userId}_${ts}`
    case 'project_order':
      if (!payload.orderId) throw new Error('orderId required for project_order')
      return `project_${payload.orderId}_${ts}`
    case 'task_escrow':
      if (!payload.orderId) throw new Error('orderId required for task_escrow')
      return `task_${payload.orderId}_${ts}`
    case 'collective_order_slot':
      if (!payload.orderId) throw new Error('orderId required for collective_order_slot')
      return `coslot_${payload.orderId}_${ts}`
    case 'scheduled_service_slot':
      if (!payload.orderId) throw new Error('orderId required for scheduled_service_slot')
      return `ssslot_${payload.orderId}_${ts}`
    case 'public_pool_contribution':
      if (!payload.userId) throw new Error('userId required for public_pool_contribution')
      if (!payload.poolSlug) throw new Error('poolSlug required for public_pool_contribution')
      // Format: poolcontrib_{userId}_{ts}_{base64url(poolSlug)} — encode last (may contain _)
      return `poolcontrib_${payload.userId}_${ts}_${encodeArticleIdForOrder(payload.poolSlug)}`
    default:
      throw new Error(`Unsupported purpose for order reference: ${purpose}`)
  }
}

export function parseOrderReference(orderReference: string): ParsedOrderReference | null {
  // store_{fullOrderId}_{timestamp} — order ids contain underscores (order_ts_rand)
  const storeMatch = orderReference.match(/^store_(.+)_(\d+)$/)
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

  const walletTopupMatch = orderReference.match(/^wallettopup_([^_]+)_(\d+)$/)
  if (walletTopupMatch) {
    return {
      purpose: 'wallet_topup',
      entityId: walletTopupMatch[1],
      userId: walletTopupMatch[1],
      timestamp: Number(walletTopupMatch[2]),
    }
  }

  const tokenOnrampMatch = orderReference.match(/^tokenonramp_([^_]+)_(\d+)$/)
  if (tokenOnrampMatch) {
    return {
      purpose: 'native_token_onramp',
      entityId: tokenOnrampMatch[1],
      userId: tokenOnrampMatch[1],
      timestamp: Number(tokenOnrampMatch[2]),
    }
  }

  // project_{fullOrderId}_{timestamp} — order ids contain underscores (po_ts_rand)
  const projectMatch = orderReference.match(/^project_(.+)_(\d+)$/)
  if (projectMatch) {
    return {
      purpose: 'project_order',
      entityId: projectMatch[1],
      timestamp: Number(projectMatch[2]),
    }
  }

  // task_{escrowId}_{timestamp} — escrow ids may contain underscores
  const taskEscrowMatch = orderReference.match(/^task_(.+)_(\d+)$/)
  if (taskEscrowMatch) {
    return {
      purpose: 'task_escrow',
      entityId: taskEscrowMatch[1],
      timestamp: Number(taskEscrowMatch[2]),
    }
  }

  const collectiveSlotMatch = orderReference.match(/^coslot_(.+)_(\d+)$/)
  if (collectiveSlotMatch) {
    return {
      purpose: 'collective_order_slot',
      entityId: collectiveSlotMatch[1],
      timestamp: Number(collectiveSlotMatch[2]),
    }
  }

  const scheduledSlotMatch = orderReference.match(/^ssslot_(.+)_(\d+)$/)
  if (scheduledSlotMatch) {
    return {
      purpose: 'scheduled_service_slot',
      entityId: scheduledSlotMatch[1],
      timestamp: Number(scheduledSlotMatch[2]),
    }
  }

  // poolcontrib_{userId}_{ts}_{base64url(poolSlug)}
  const poolContribMatch = orderReference.match(/^poolcontrib_([^_]+)_(\d+)_(.+)$/)
  if (poolContribMatch) {
    let poolSlug = poolContribMatch[3]
    try {
      poolSlug = Buffer.from(poolContribMatch[3], 'base64url').toString('utf8')
    } catch {
      // keep encoded form
    }
    return {
      purpose: 'public_pool_contribution',
      entityId: poolSlug,
      userId: poolContribMatch[1],
      timestamp: Number(poolContribMatch[2]),
    }
  }

  return null
}
