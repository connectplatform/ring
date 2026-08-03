/** Pure overlay path / gitUrl helpers — safe for client tests (no server-only). */

export type ParsedRepo = {
  owner: string
  repo: string
  gitUrl: string
}

const OVERLAY_EXACT = new Set([
  'ring-config.json',
  'customization.json',
  '.reggie-propagate-exclude.json',
])

export const OVERLAY_PREFIXES = ['locales/', 'messages/', 'overlays/'] as const

export function parseForgejoGitUrl(gitUrl: string): ParsedRepo | null {
  const trimmed = gitUrl.trim()
  const m = trimmed.match(
    /(?:https?:\/\/[^/]+\/|git@[^:]+:)(?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?\/?$/i,
  )
  if (!m?.groups?.owner || !m.groups.repo) return null
  return {
    owner: m.groups.owner,
    repo: m.groups.repo,
    gitUrl: trimmed,
  }
}

export function isOverlayPathAllowed(rawPath: string): boolean {
  if (!rawPath || rawPath.startsWith('/') || rawPath.includes('\\')) return false
  if (rawPath.includes('..')) return false
  const path = rawPath.replace(/^\.\//, '').replace(/\/+$/, '')
  if (!path) return false
  if (OVERLAY_EXACT.has(path)) return true
  return OVERLAY_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length)
}

export function isOverlayDirRelevant(dirPath: string): boolean {
  const asPrefix = `${dirPath}/`
  return (
    OVERLAY_PREFIXES.some((p) => p.startsWith(asPrefix) || asPrefix.startsWith(p)) ||
    OVERLAY_EXACT.has(dirPath)
  )
}
