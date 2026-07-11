import type { AdminNavLabelKey } from '@/features/admin/admin-nav-config'

/**
 * Maps admin nav labelKeys to dotted paths under `modules.admin`.
 * Hub objects use a short `nav` leaf; flat hubs use identity paths.
 */
export const ADMIN_NAV_MESSAGE_PATHS: Partial<
  Record<AdminNavLabelKey | 'fraudDesk' | 'verification', string>
> = {
  matcher: 'matcher.nav',
  settings: 'settings.nav',
  processes: 'processes.nav',
  subscriptions: 'subscriptions.nav',
  fraudDesk: 'fraudDesk.nav',
  verification: 'verificationQueue.nav',
  web3: 'web3.nav',
  web3Overview: 'web3.navOverview',
  web3Settings: 'web3.navSettings',
  web3Nft: 'web3.navNft',
  web3NftMint: 'web3.navNftMint',
}

export function resolveAdminNavMessagePath(labelKey: string): string {
  return ADMIN_NAV_MESSAGE_PATHS[labelKey as keyof typeof ADMIN_NAV_MESSAGE_PATHS] ?? labelKey
}

type AdminTranslationFn = (key: string, ...args: unknown[]) => string

/** Resolve a nav label via SSOT path; returns undefined if missing or non-string. */
export function resolveAdminNavMessage(
  t: AdminTranslationFn,
  labelKey: string,
): string | undefined {
  const path = resolveAdminNavMessagePath(labelKey)
  try {
    const value = t(path)
    return typeof value === 'string' && value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/** Resolve any modules.admin message path to a string (tiles, tab labels, etc.). */
export function resolveAdminMessage(
  t: AdminTranslationFn,
  messagePath: string,
  fallback = '',
): string {
  try {
    const value = t(messagePath)
    if (typeof value !== 'string' || value.length === 0 || value === messagePath) {
      return fallback
    }
    return value
  } catch {
    return fallback
  }
}
