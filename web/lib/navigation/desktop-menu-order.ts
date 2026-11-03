/**
 * Signed-in desktop sidebar order.
 *
 * Layer1 default stays the historical utility block, then desktop primary nav.
 * A clone sets `ring-config.json` → `navigation.desktopMenu` (`items` / `exclude`).
 * Chrome files stay on Layer1; packs do not overwrite this module.
 */
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

export const DEFAULT_DESKTOP_UTILITY_IDS = [
  'profile',
  'wallet',
  'notifications',
  'messages',
  'games',
  'tasks',
  'cart',
  'favorites',
] as const

const UTILITY_IDS = new Set<string>(DEFAULT_DESKTOP_UTILITY_IDS)

export type DesktopMenuOrderConfig = {
  items?: readonly string[]
  exclude?: readonly string[]
}

export function orderDesktopMenuIds(
  primaryIds: readonly string[],
  config?: DesktopMenuOrderConfig | null,
): string[] {
  const exclude = new Set(config?.exclude ?? [])
  const primary = new Set(primaryIds)
  const known = (id: string) => UTILITY_IDS.has(id) || primary.has(id)
  const seen = new Set<string>()
  const out: string[] = []

  const push = (id: string) => {
    if (seen.has(id) || exclude.has(id) || !known(id)) return
    seen.add(id)
    out.push(id)
  }

  if (config?.items?.length) {
    for (const id of config.items) push(id)
    for (const id of primaryIds) push(id)
    return out
  }

  for (const id of DEFAULT_DESKTOP_UTILITY_IDS) push(id)
  for (const id of primaryIds) push(id)
  return out
}

export function orderDesktopUtilityIds(config?: DesktopMenuOrderConfig | null): string[] {
  return orderDesktopMenuIds([], config).filter((id) => UTILITY_IDS.has(id))
}

function readDesktopMenuConfig(): DesktopMenuOrderConfig {
  return getSystemConfigSnapshot().navigation?.desktopMenu ?? {}
}

export function resolveDesktopMenuIds(primaryIds: readonly string[]): string[] {
  return orderDesktopMenuIds(primaryIds, readDesktopMenuConfig())
}

export function resolveDesktopUtilityIds(): string[] {
  return orderDesktopUtilityIds(readDesktopMenuConfig())
}
