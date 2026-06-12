/** Sidebar width persistence — cookie (SSR) + localStorage (client). */

export const SIDEBAR_COOKIE_NAME = 'ring-sidebar'
export const SIDEBAR_STORAGE_KEY = 'ring-sidebar'
export const SIDEBAR_RAIL_W = 64
export const SIDEBAR_ASIDE_DEFAULT = 270
export const SIDEBAR_ASIDE_MAX = 320
export const SIDEBAR_ASIDE_COLLAPSE_THRESHOLD = 220
export const SIDEBAR_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365

export interface SidebarPersistedState {
  asideW: number
  collapsed: boolean
}

export function parseSidebarCookie(raw: string | undefined): SidebarPersistedState {
  if (!raw) {
    return { asideW: SIDEBAR_ASIDE_DEFAULT, collapsed: false }
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<SidebarPersistedState>
    const asideW =
      typeof parsed.asideW === 'number'
        ? Math.min(SIDEBAR_ASIDE_MAX, Math.max(0, parsed.asideW))
        : SIDEBAR_ASIDE_DEFAULT
    const collapsed = Boolean(parsed.collapsed)
    return {
      asideW: collapsed ? 0 : asideW,
      collapsed,
    }
  } catch {
    return { asideW: SIDEBAR_ASIDE_DEFAULT, collapsed: false }
  }
}

export function sidebarAsideCssValue(state: SidebarPersistedState): string {
  return `${state.collapsed ? 0 : state.asideW}px`
}

export function persistSidebarState(state: SidebarPersistedState): void {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify(state)
  localStorage.setItem(SIDEBAR_STORAGE_KEY, payload)
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${encodeURIComponent(payload)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE_SEC}; SameSite=Lax`
}

export function readSidebarStateFromStorage(): SidebarPersistedState {
  if (typeof window === 'undefined') {
    return { asideW: SIDEBAR_ASIDE_DEFAULT, collapsed: false }
  }
  const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
  if (!raw) return { asideW: SIDEBAR_ASIDE_DEFAULT, collapsed: false }
  return parseSidebarCookie(raw)
}

export function applySidebarCssVars(asideW: number): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--sidebar-aside-w', `${asideW}px`)
}
