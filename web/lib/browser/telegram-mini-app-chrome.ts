export type TelegramThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  button_color?: string
  secondary_bg_color?: string
}

export type TelegramSafeAreaInset = {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export const TG_THEME_VARS = {
  bg_color: '--tg-theme-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  button_color: '--tg-theme-button-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
} as const

export const TG_SAFE_AREA_VARS = [
  '--tg-safe-area-inset-top',
  '--tg-safe-area-inset-bottom',
  '--tg-safe-area-inset-left',
  '--tg-safe-area-inset-right',
  '--tg-content-safe-area-inset-top',
  '--tg-content-safe-area-inset-bottom',
  '--tg-content-safe-area-inset-left',
  '--tg-content-safe-area-inset-right',
] as const

const THEME_KEYS = [
  'bg_color',
  'text_color',
  'hint_color',
  'button_color',
  'secondary_bg_color',
] as const

function asCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)
    ? trimmed
    : null
}

function asPx(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return `${value}px`
}

export function cssVarsFromThemeParams(
  params: TelegramThemeParams | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!params) return out
  for (const key of THEME_KEYS) {
    const color = asCssColor(params[key])
    if (color) out[TG_THEME_VARS[key]] = color
  }
  return out
}

export function cssVarsFromSafeArea(
  safe?: TelegramSafeAreaInset | null,
  content?: TelegramSafeAreaInset | null,
): Record<string, string> {
  const out: Record<string, string> = {}
  const top = asPx(safe?.top)
  const bottom = asPx(safe?.bottom)
  const left = asPx(safe?.left)
  const right = asPx(safe?.right)
  if (top) out['--tg-safe-area-inset-top'] = top
  if (bottom) out['--tg-safe-area-inset-bottom'] = bottom
  if (left) out['--tg-safe-area-inset-left'] = left
  if (right) out['--tg-safe-area-inset-right'] = right
  const cTop = asPx(content?.top)
  const cBottom = asPx(content?.bottom)
  const cLeft = asPx(content?.left)
  const cRight = asPx(content?.right)
  if (cTop) out['--tg-content-safe-area-inset-top'] = cTop
  if (cBottom) out['--tg-content-safe-area-inset-bottom'] = cBottom
  if (cLeft) out['--tg-content-safe-area-inset-left'] = cLeft
  if (cRight) out['--tg-content-safe-area-inset-right'] = cRight
  return out
}

export function isPeerGamesPath(pathname: string): boolean {
  return /(?:^|\/)games(?:\/|$)/.test(pathname)
}

export function applyCssVars(el: HTMLElement, vars: Record<string, string>): void {
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value)
  }
}

export function clearCssVars(el: HTMLElement, names: readonly string[]): void {
  for (const name of names) {
    el.style.removeProperty(name)
  }
}
