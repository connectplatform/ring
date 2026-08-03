import 'server-only'

import { isPlatformAdmin } from '@/features/auth/user-role'
import type { WikiActor } from '@/features/wiki/acl'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'

export async function resolveWikiActor(input: {
  userId: string
  role?: string | null
  isAgent?: boolean
  orderId?: string
}): Promise<WikiActor> {
  const { userId, role, isAgent, orderId } = input

  if (isAgent) {
    return {
      userId,
      role,
      isAgent: true,
      isBuyerOf: () => true,
      isIntegratorOf: () => true,
    }
  }

  if (isPlatformAdmin(role)) {
    return {
      userId,
      role,
      isBuyer: true,
      isIntegrator: true,
      isBuyerOf: () => true,
      isIntegratorOf: () => true,
    }
  }

  let isBuyer = false
  let isIntegrator = false
  const buyerOrderIds = new Set<string>()
  const integratorOrderIds = new Set<string>()

  try {
    const owned = await ProjectOrderService.listForUser(userId)
    for (const o of owned) {
      buyerOrderIds.add(o.id)
      isBuyer = true
    }
  } catch {
    /* ignore */
  }

  try {
    const assigned = await ProjectOrderService.listForIntegrator(userId)
    for (const o of assigned) {
      integratorOrderIds.add(o.id)
      isIntegrator = true
    }
  } catch {
    /* ignore */
  }

  if (orderId) {
    try {
      const order = await ProjectOrderService.getById(orderId)
      if (order?.userId === userId) {
        isBuyer = true
        buyerOrderIds.add(orderId)
      }
      if (order?.integratorId === userId) {
        isIntegrator = true
        integratorOrderIds.add(orderId)
      }
    } catch {
      /* ignore */
    }
  }

  return {
    userId,
    role,
    isBuyer,
    isIntegrator,
    isBuyerOf: (id) => buyerOrderIds.has(id),
    isIntegratorOf: (id) => integratorOrderIds.has(id),
  }
}
