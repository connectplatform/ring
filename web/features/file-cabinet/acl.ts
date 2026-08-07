import type {
  FileCabinetAclRole,
  FileCabinetPermission,
} from '@/features/file-cabinet/types'

export function canOwnerMutate(role: FileCabinetAclRole | null | undefined): boolean {
  return role === 'owner'
}

/** Owner + trustee may view/list/download. Trustee cannot mutate. */
export function canRead(role: FileCabinetAclRole | null | undefined): boolean {
  return role === 'owner' || role === 'trustee'
}

export function canEditAcl(role: FileCabinetAclRole | null | undefined): boolean {
  return role === 'owner'
}

export function permissionFromRole(
  role: FileCabinetAclRole | null | undefined,
  denyMessage = 'Access denied',
): FileCabinetPermission {
  if (!role) return { ok: false, error: denyMessage }
  return { ok: true, role }
}

/** Normalize legacy ACL role `editor` → `trustee` (pre-trustee rename). */
export function normalizeAclRole(raw: string | undefined | null): FileCabinetAclRole {
  if (raw === 'owner') return 'owner'
  if (raw === 'trustee' || raw === 'editor') return 'trustee'
  return 'trustee'
}
