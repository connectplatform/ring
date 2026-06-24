export type NormalizedAccountStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'DELETED'
  | 'DELETION_PENDING'

export function normalizeAccountStatus(
  raw?: string | null,
): NormalizedAccountStatus {
  if (!raw) return 'ACTIVE'
  const normalized = raw.trim().toLowerCase()
  switch (normalized) {
    case 'suspended':
      return 'SUSPENDED'
    case 'deactivated':
    case 'deactivation_pending':
      return 'DEACTIVATED'
    case 'deleted':
      return 'DELETED'
    case 'deletion_pending':
      return 'DELETION_PENDING'
    case 'active':
      return 'ACTIVE'
    default:
      if (raw === 'SUSPENDED') return 'SUSPENDED'
      if (raw === 'DEACTIVATED') return 'DEACTIVATED'
      if (raw === 'DELETED') return 'DELETED'
      if (raw === 'ACTIVE') return 'ACTIVE'
      return 'ACTIVE'
  }
}

export function isAccountLoginAllowed(status: NormalizedAccountStatus): boolean {
  return status === 'ACTIVE' || status === 'SUSPENDED' || status === 'DELETION_PENDING'
}

export function isAccountAppAccessAllowed(status: NormalizedAccountStatus): boolean {
  return status === 'ACTIVE'
}
