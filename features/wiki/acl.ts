import { isPlatformAdmin, parseUserRolesArray } from '@/features/auth/user-role'
import type { VaultKey, WikiWriteMode } from '@/features/wiki/types'
import { parseProjectOrderId } from '@/features/wiki/vault-key'

export interface WikiActor {
  userId: string
  role?: string | null
  /** ring-mcp service principal — tenant read-only */
  isAgent?: boolean
  /** Platform / order buyer (owns project orders) */
  isBuyer?: boolean
  /** Assigned integrator on one or more orders */
  isIntegrator?: boolean
  isBuyerOf?: (orderId: string) => boolean
  isIntegratorOf?: (orderId: string) => boolean
}

export type WikiPermission =
  | { ok: true; writeMode: WikiWriteMode | 'full' }
  | { ok: false; error: string }

export function canReadVault(actor: WikiActor, vaultKey: VaultKey): WikiPermission {
  if (!actor.userId && !actor.isAgent) {
    return { ok: false, error: 'Authentication required' }
  }

  if (isPlatformAdmin(actor.role) || actor.isAgent) {
    return { ok: true, writeMode: 'full' }
  }

  if (vaultKey === 'tenant') {
    // Tenant catalog: buyers, integrators, admins (admins already returned)
    if (actor.isBuyer || actor.isIntegrator) {
      return { ok: true, writeMode: 'full' }
    }
    return { ok: false, error: 'Tenant wiki requires buyer, integrator, or admin' }
  }

  const orderId = parseProjectOrderId(vaultKey)
  if (!orderId) return { ok: false, error: 'Invalid vault' }

  if (actor.isBuyerOf?.(orderId) || actor.isIntegratorOf?.(orderId)) {
    return { ok: true, writeMode: 'full' }
  }
  return { ok: false, error: 'Access denied to project vault' }
}

export function canWriteVault(
  actor: WikiActor,
  vaultKey: VaultKey,
  requestedMode: WikiWriteMode = 'replace',
): WikiPermission {
  const read = canReadVault(actor, vaultKey)
  if (!read.ok) return read

  if (vaultKey === 'tenant') {
    if (actor.isAgent) {
      return { ok: false, error: 'Agents have read-only access to the tenant vault' }
    }
    if (isPlatformAdmin(actor.role) || actor.isBuyer) {
      return { ok: true, writeMode: requestedMode === 'append' ? 'append' : 'full' }
    }
    if (actor.isIntegrator) {
      if (requestedMode === 'replace') {
        return {
          ok: false,
          error: 'Integrators may only append to tenant wiki pages (no overwrite)',
        }
      }
      return { ok: true, writeMode: 'append' }
    }
    return { ok: false, error: 'Write denied on tenant vault' }
  }

  // Project vault: buyer, integrator, admin, agent — full R/W
  const orderId = parseProjectOrderId(vaultKey)
  if (!orderId) return { ok: false, error: 'Invalid vault' }

  if (actor.isAgent || isPlatformAdmin(actor.role)) {
    return { ok: true, writeMode: requestedMode === 'append' ? 'append' : 'full' }
  }
  if (actor.isBuyerOf?.(orderId) || actor.isIntegratorOf?.(orderId)) {
    return { ok: true, writeMode: requestedMode === 'append' ? 'append' : 'full' }
  }
  return { ok: false, error: 'Write denied on project vault' }
}

export function canDeleteInVault(actor: WikiActor, vaultKey: VaultKey): WikiPermission {
  if (actor.isAgent && vaultKey === 'tenant') {
    return { ok: false, error: 'Agents cannot delete tenant wiki pages' }
  }
  if (vaultKey === 'tenant' && actor.isIntegrator && !actor.isBuyer && !isPlatformAdmin(actor.role)) {
    return { ok: false, error: 'Integrators cannot delete tenant wiki pages' }
  }
  return canWriteVault(actor, vaultKey, 'replace')
}

export function canCreateInVault(actor: WikiActor, vaultKey: VaultKey): WikiPermission {
  if (actor.isAgent && vaultKey === 'tenant') {
    return { ok: false, error: 'Agents cannot create tenant wiki pages' }
  }
  if (vaultKey === 'tenant' && actor.isIntegrator && !actor.isBuyer && !isPlatformAdmin(actor.role)) {
    return { ok: true, writeMode: 'append' }
  }
  return canWriteVault(actor, vaultKey, 'append')
}

export function describeActorRole(actor: WikiActor): string {
  if (actor.isAgent) return 'agent'
  const parsed = parseUserRolesArray(actor.role)
  return parsed || 'user'
}
