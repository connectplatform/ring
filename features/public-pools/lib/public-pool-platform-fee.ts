import 'server-only'

import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { UserRolesArray, parseUserRolesArray, hasRoleAtLeast } from '@/features/auth/user-role'

/**
 * Platform processing fee for DAO / collective jar builder payout.
 * SSOT: ring-config `publicPools.platformFeePercentByRole` (and daoPools overlay).
 *
 * Defaults (Emperor 2026-07-21):
 * - admin / superadmin opportunities: 0%
 * - confidential: 6%
 * - member (and below elevated): 7%
 * - subscriber / visitor: 7% (same as member floor for jar creators)
 */
export type PlatformFeeByRole = Partial<Record<string, number>>

const DEFAULT_FEE_PERCENT_BY_ROLE: Record<string, number> = {
  visitor: 7,
  subscriber: 7,
  member: 7,
  confidential: 6,
  admin: 0,
  superadmin: 0,
}

function readFeeMap(): Record<string, number> {
  const snap = getSystemConfigSnapshot() as unknown as {
    publicPools?: { platformFeePercentByRole?: PlatformFeeByRole }
    daoPools?: { platformFeePercentByRole?: PlatformFeeByRole } | unknown
  }
  const fromPublic = snap.publicPools?.platformFeePercentByRole
  const dao = snap.daoPools
  const fromDao =
    dao && typeof dao === 'object' && !Array.isArray(dao)
      ? (dao as { platformFeePercentByRole?: PlatformFeeByRole }).platformFeePercentByRole
      : undefined
  return {
    ...DEFAULT_FEE_PERCENT_BY_ROLE,
    ...(fromDao ?? {}),
    ...(fromPublic ?? {}),
  }
}

/** Highest applicable fee role for the opportunity / pool builder. */
export function resolveBuilderPlatformFeePercent(
  builderRole: string | UserRolesArray | null | undefined,
): number {
  const map = readFeeMap()
  const role =
    parseUserRolesArray(typeof builderRole === 'string' ? builderRole : builderRole ?? null) ??
    UserRolesArray.member

  if (hasRoleAtLeast(role, UserRolesArray.admin)) {
    return Number(map.admin ?? map.superadmin ?? 0) || 0
  }
  if (role === UserRolesArray.confidential) {
    return Number(map.confidential ?? 6) || 0
  }
  if (role === UserRolesArray.member) {
    return Number(map.member ?? 7) || 0
  }
  return Number(map[role] ?? map.member ?? 7) || 0
}

/** Net native UI amount after platform fee (fee on gross pledged). */
export function applyPlatformFeeToPledged(
  pledgedUi: string | number,
  feePercent: number,
): { gross: number; fee: number; net: number; feePercent: number } {
  const gross = typeof pledgedUi === 'number' ? pledgedUi : parseFloat(String(pledgedUi))
  const safeGross = Number.isFinite(gross) && gross > 0 ? gross : 0
  const pct = Number.isFinite(feePercent) && feePercent > 0 ? Math.min(100, feePercent) : 0
  const fee = (safeGross * pct) / 100
  const net = Math.max(0, safeGross - fee)
  return { gross: safeGross, fee, net, feePercent: pct }
}
