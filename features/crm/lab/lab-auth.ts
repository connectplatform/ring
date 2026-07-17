import 'server-only'

import { auth } from '@/auth'
import {
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRolesArray,
} from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import type { ProjectOrder } from '@/features/crm/orders/types'

export type LabAccessRole = 'admin' | 'integrator' | 'buyer'

export type LabAuthResult =
  | {
      ok: true
      userId: string
      order: ProjectOrder
      isAdmin: boolean
      role: LabAccessRole
    }
  | { ok: false; status: 401 | 403 | 404; error: string }

export type LabAuthOptions = {
  /** When true, buyers (order.userId) are allowed. Default false for deploy/env routes. */
  allowBuyer?: boolean
}

/**
 * Lab access: platform admin, assigned integrator, or (opt-in) buyer/owner.
 * Buyers are allowed for chat + read-only order surfaces only.
 */
export async function requireOrderLabAccess(
  orderId: string,
  options: LabAuthOptions = {},
): Promise<LabAuthResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }

  const userId = session.user.id
  const admin = isPlatformAdmin(session.user.role)
  const order = await ProjectOrderService.getById(orderId)
  if (!order) {
    return { ok: false, status: 404, error: 'Not found' }
  }

  if (admin) {
    return { ok: true as const, userId, order, isAdmin: true, role: 'admin' }
  }

  if (order.integratorId === userId) {
    const role = parseUserRolesArray(session.user.role)
    if (!role || !hasMemberPrivileges(role)) {
      return { ok: false, status: 403, error: 'Member required' }
    }
    return { ok: true as const, userId, order, isAdmin: false, role: 'integrator' }
  }

  if (options.allowBuyer && order.userId === userId) {
    return { ok: true as const, userId, order, isAdmin: false, role: 'buyer' }
  }

  return { ok: false, status: 403, error: 'Access denied' }
}

/** Narrowing helper for route handlers */
export function labAuthDenied(
  access: LabAuthResult,
): access is Extract<LabAuthResult, { ok: false }> {
  return access.ok === false
}

/** Reject buyers on mutate/deploy/env routes after a successful allowBuyer-capable check. */
export function labAuthRejectBuyer(
  access: Extract<LabAuthResult, { ok: true }>,
): NextResponseLike | null {
  if (access.role === 'buyer') {
    return { error: 'Buyers cannot modify deployment or env', status: 403 }
  }
  return null
}

type NextResponseLike = { error: string; status: 403 }
