/**
 * Monthly Forgejo per-order PAT rotation for Order Source Editor.
 * Rotates tokens older than TTL on active (non-canceled) orders via rotateOrderSourceToken.
 */
import 'server-only'

import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { rotateOrderSourceToken } from '@/features/crm/lab/order-source-auth-service'
import { isForgejoAdminConfigured } from '@/features/crm/lab/forgejo-admin-client'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { logger } from '@/lib/logger'

const DEFAULT_MAX_AGE_DAYS = 30
const DEFAULT_LIMIT = 50

export type TokenRotateResult = {
  success: boolean
  scanned: number
  eligible: number
  rotated: number
  skippedYoung: number
  skippedRevoked: number
  skippedInactive: number
  skippedNoCipher: number
  failed: number
  orderIds: string[]
  durationMs: number
  maxAgeDays: number
  limit: number
  error?: string
}

function ageMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Date.now() - t
}

function isOrderActive(order: {
  workStatus?: string
  paymentStatus?: string
} | null): boolean {
  if (!order) return false
  if (order.workStatus === 'canceled') return false
  if (order.paymentStatus === 'refunded') return false
  return true
}

export async function runForgejoTokenRotate(opts?: {
  maxAgeDays?: number
  limit?: number
}): Promise<TokenRotateResult> {
  const started = Date.now()
  const maxAgeDays = Math.max(
    1,
    opts?.maxAgeDays ??
      Number(process.env.FORGEJO_TOKEN_ROTATE_MAX_AGE_DAYS || DEFAULT_MAX_AGE_DAYS),
  )
  const limit = Math.max(
    1,
    Math.min(
      200,
      opts?.limit ?? Number(process.env.FORGEJO_TOKEN_ROTATE_LIMIT || DEFAULT_LIMIT),
    ),
  )
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

  if (!isForgejoAdminConfigured()) {
    return {
      success: false,
      scanned: 0,
      eligible: 0,
      rotated: 0,
      skippedYoung: 0,
      skippedRevoked: 0,
      skippedInactive: 0,
      skippedNoCipher: 0,
      failed: 0,
      orderIds: [],
      durationMs: Date.now() - started,
      maxAgeDays,
      limit,
      error: 'RING_FORGEJO_ADMIN_USER/PASSWORD not configured',
    }
  }

  const refs = await ProjectDeploymentService.listSourceAuthRefs()
  let skippedYoung = 0
  let skippedRevoked = 0
  let skippedInactive = 0
  let skippedNoCipher = 0
  let eligible = 0
  let rotated = 0
  let failed = 0
  const orderIds: string[] = []

  for (const ref of refs) {
    // listSourceAuthRefs only returns rows with robotUsername; need ciphertext age
    const dep = await ProjectDeploymentService.getByOrderId(ref.orderId)
    const auth = dep?.sourceAuth
    if (!auth?.tokenEncrypted) {
      skippedNoCipher += 1
      continue
    }
    if (auth.revokedAt) {
      skippedRevoked += 1
      continue
    }

    const age = ageMs(auth.rotatedAt || auth.mintedAt)
    if (age === null || age < maxAgeMs) {
      skippedYoung += 1
      continue
    }

    const order = await ProjectOrderService.getById(ref.orderId)
    if (!isOrderActive(order)) {
      skippedInactive += 1
      continue
    }

    eligible += 1
    if (rotated + failed >= limit) continue

    try {
      await rotateOrderSourceToken(ref.orderId)
      rotated += 1
      orderIds.push(ref.orderId)
    } catch (err) {
      failed += 1
      logger.warn('Forgejo token rotate failed for order', {
        orderId: ref.orderId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('Forgejo token rotate complete', {
    scanned: refs.length,
    eligible,
    rotated,
    failed,
    skippedYoung,
    skippedRevoked,
    skippedInactive,
    skippedNoCipher,
    maxAgeDays,
    limit,
  })

  return {
    success: failed === 0,
    scanned: refs.length,
    eligible,
    rotated,
    skippedYoung,
    skippedRevoked,
    skippedInactive,
    skippedNoCipher,
    failed,
    orderIds,
    durationMs: Date.now() - started,
    maxAgeDays,
    limit,
  }
}
