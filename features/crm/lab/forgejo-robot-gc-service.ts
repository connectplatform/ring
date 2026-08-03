/**
 * Forgejo orphan order-src-* robot GC.
 * Deletes robots that are unreferenced or only referenced by canceled orders with revokedAt.
 * Age guard: skip robots created < 7 days ago.
 */
import 'server-only'

import {
  deleteUser,
  listUsers,
  isForgejoAdminConfigured,
} from '@/features/crm/lab/forgejo-admin-client'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { logger } from '@/lib/logger'

const ROBOT_PREFIX = 'order-src-'
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type RobotGcResult = {
  success: boolean
  dryRun: boolean
  scanned: number
  candidates: number
  deleted: number
  skippedYoung: number
  skippedActive: number
  clearedSourceAuth: number
  robots: Array<{ login: string; action: 'delete' | 'skip_young' | 'skip_active' | 'would_delete' }>
  durationMs: number
  error?: string
}

function isOldEnough(createdIso: string, now: number): boolean {
  if (!createdIso) return true // unknown age → allow GC (safer than forever orphans)
  const t = Date.parse(createdIso)
  if (Number.isNaN(t)) return true
  return now - t >= MIN_AGE_MS
}

export async function runForgejoRobotGc(opts?: {
  dryRun?: boolean
}): Promise<RobotGcResult> {
  const dryRun = Boolean(opts?.dryRun)
  const started = Date.now()
  const robots: RobotGcResult['robots'] = []

  if (!isForgejoAdminConfigured()) {
    return {
      success: false,
      dryRun,
      scanned: 0,
      candidates: 0,
      deleted: 0,
      skippedYoung: 0,
      skippedActive: 0,
      clearedSourceAuth: 0,
      robots: [],
      durationMs: Date.now() - started,
      error: 'RING_FORGEJO_ADMIN_USER/PASSWORD not configured',
    }
  }

  const users = await listUsers()
  const refs = await ProjectDeploymentService.listSourceAuthRefs()
  const byRobot = new Map<string, typeof refs>()
  for (const r of refs) {
    const list = byRobot.get(r.robotUsername) || []
    list.push(r)
    byRobot.set(r.robotUsername, list)
  }

  let deleted = 0
  let skippedYoung = 0
  let skippedActive = 0
  let clearedSourceAuth = 0
  let candidates = 0
  const now = Date.now()

  for (const u of users) {
    if (!u.login.startsWith(ROBOT_PREFIX)) continue
    candidates += 1

    if (!isOldEnough(u.created, now)) {
      skippedYoung += 1
      robots.push({ login: u.login, action: 'skip_young' })
      continue
    }

    const linked = byRobot.get(u.login) || []
    let canDelete = linked.length === 0

    if (!canDelete) {
      // All linked orders must be canceled/refunded AND have revokedAt
      let allRevokedDead = true
      for (const ref of linked) {
        if (!ref.revokedAt) {
          allRevokedDead = false
          break
        }
        const order = await ProjectOrderService.getById(ref.orderId)
        const dead =
          !order ||
          order.workStatus === 'canceled' ||
          order.paymentStatus === 'refunded'
        if (!dead) {
          allRevokedDead = false
          break
        }
      }
      canDelete = allRevokedDead
    }

    if (!canDelete) {
      skippedActive += 1
      robots.push({ login: u.login, action: 'skip_active' })
      continue
    }

    if (dryRun) {
      robots.push({ login: u.login, action: 'would_delete' })
      continue
    }

    await deleteUser(u.login)
    deleted += 1
    robots.push({ login: u.login, action: 'delete' })

    for (const ref of linked) {
      await ProjectDeploymentService.patch(ref.orderId, { sourceAuth: null })
      clearedSourceAuth += 1
    }
  }

  logger.info('Forgejo robot GC complete', {
    dryRun,
    scanned: users.length,
    candidates,
    deleted,
    skippedYoung,
    skippedActive,
    clearedSourceAuth,
  })

  return {
    success: true,
    dryRun,
    scanned: users.length,
    candidates,
    deleted: dryRun ? 0 : deleted,
    skippedYoung,
    skippedActive,
    clearedSourceAuth: dryRun ? 0 : clearedSourceAuth,
    robots,
    durationMs: Date.now() - started,
  }
}
