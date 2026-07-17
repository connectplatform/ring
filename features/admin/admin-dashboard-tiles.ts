import type { ComponentType } from 'react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  filterAdminNavByRole,
  type AdminNavIconKey,
  type AdminNavItem,
} from '@/features/admin/admin-nav-config'
import {
  resolveAdminMessage,
  resolveAdminNavMessagePath,
} from '@/features/admin/admin-nav-message-paths'
import { getAdminNavIconComponent } from '@/features/admin/admin-nav-icons'
import { parseUserRolesArray } from '@/features/auth/user-role'

const TILE_COLORS: Record<string, string> = {
  users: 'bg-blue-500',
  news: 'bg-green-500',
  dao: 'bg-amber-500',
  moderation: 'bg-orange-500',
  analytics: 'bg-purple-500',
  security: 'bg-red-500',
  matcher: 'bg-indigo-500',
  store: 'bg-teal-500',
  refcodes: 'bg-pink-500',
  'crm-inbox': 'bg-cyan-500',
  settings: 'bg-slate-600',
  processes: 'bg-indigo-600',
  performance: 'bg-yellow-600',
  subscriptions: 'bg-violet-600',
  web3: 'bg-emerald-600',
}

export interface AdminDashboardTile {
  id: string
  title: string
  description: string
  href: string
  icon: ComponentType<{ className?: string }>
  iconKey: AdminNavIconKey
  color: string
}

type TileLabelFn = (key: string) => string

/** Resolve a next-intl message key to a string via SSOT nav paths. */
export function resolveAdminTileMessage(
  t: TileLabelFn,
  labelKey: string,
  fallback = '',
): string {
  const messagePath = resolveAdminNavMessagePath(labelKey)
  return resolveAdminMessage(t, messagePath, fallback)
}

function tileForItem(
  item: AdminNavItem,
  locale: Locale,
  label: TileLabelFn,
  description: TileLabelFn,
): AdminDashboardTile {
  return {
    id: item.id,
    title: label(item.labelKey),
    description: description(`${item.labelKey}TileDesc`),
    href: item.href(locale),
    icon: getAdminNavIconComponent(item.icon),
    iconKey: item.icon,
    color: TILE_COLORS[item.id] ?? 'bg-gray-500',
  }
}

export function buildAdminDashboardTiles(
  role: unknown,
  locale: Locale,
  label: TileLabelFn,
  description: TileLabelFn,
): AdminDashboardTile[] {
  const parsed = parseUserRolesArray(role)
  const groups = filterAdminNavByRole(parsed)
  return groups
    .flatMap((g) => g.items)
    .filter((item) => item.id !== 'dashboard')
    .map((item) => tileForItem(item, locale, label, description))
}

/** Security hub tile uses dedicated copy instead of legacy verification route. */
export function buildAdminDashboardTilesWithFallbacks(
  role: unknown,
  locale: Locale,
  t: TileLabelFn,
): AdminDashboardTile[] {
  const label = (key: string) => resolveAdminTileMessage(t, key, key)
  const desc = (key: string) => resolveAdminMessage(t, key, '')

  return buildAdminDashboardTiles(role, locale, label, desc).map((tile) => {
    if (tile.id === 'security') {
      return {
        ...tile,
        href: ROUTES.ADMIN_SECURITY(locale),
        description: desc('securityHub.pageSubtitle') || tile.description,
      }
    }
    return {
      ...tile,
      description:
        tile.description ||
        desc(`${tile.id.replace(/-/g, '')}TileDesc`) ||
        desc(`${tile.id}TileDesc`) ||
        tile.title,
    }
  })
}
