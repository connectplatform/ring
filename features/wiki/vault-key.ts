import type { VaultKey } from '@/features/wiki/types'

export const TENANT_VAULT: VaultKey = 'tenant'

export function isVaultKey(value: unknown): value is VaultKey {
  if (typeof value !== 'string' || !value) return false
  if (value === 'tenant') return true
  return value.startsWith('po:') && value.length > 3
}

export function projectVaultKey(orderId: string): VaultKey {
  const id = orderId.trim()
  if (!id) throw new Error('projectOrderId required for project vault')
  return `po:${id}`
}

export function parseProjectOrderId(vaultKey: VaultKey): string | null {
  if (vaultKey === 'tenant') return null
  if (!vaultKey.startsWith('po:')) return null
  return vaultKey.slice(3) || null
}

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'page'
}

export function normalizePath(path: string | undefined | null): string {
  if (!path) return ''
  return path
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/')
}
