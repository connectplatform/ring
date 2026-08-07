import { join } from 'node:path'

export type ResolveLocalStorageRootOptions = {
  /** Project root; defaults to `process.cwd()` (NFT-ignored). */
  cwd?: string
  /**
   * When set, used instead of `LOCAL_STORAGE_DIR` and the default `public/uploads`.
   * Absolute paths are used as-is. Relative paths other than `public/uploads`
   * are resolved under that default tree when possible; prefer absolute mounts in prod.
   */
  configuredDir?: string
}

/**
 * Absolute filesystem directory where local file keys are stored (e.g. `refmagic/outputs/...`).
 * Must stay aligned with {@link LocalStorageAdapter} and any route that reads the same files.
 *
 * Turbopack NFT: never `join(process.cwd(), dynamicVar)` — that traces the whole repo.
 * Default path uses **static** segments `public` / `uploads` plus `turbopackIgnore` on cwd.
 */
export function resolveLocalStorageRoot(
  options?: ResolveLocalStorageRootOptions
): string {
  const configuredRaw =
    options?.configuredDir ?? process.env.LOCAL_STORAGE_DIR ?? ''
  const configured = configuredRaw.trim()

  // Absolute override (Docker/K8s volume) — no cwd join, no NFT project-root hazard
  if (configured.startsWith('/')) {
    return configured
  }

  const root = options?.cwd

  // Default (and legacy "public/uploads" string): statically scoped subfolder
  if (!configured || configured === 'public/uploads') {
    if (root) {
      return join(root, 'public', 'uploads')
    }
    return join(
      /* turbopackIgnore: true */ process.cwd(),
      'public',
      'uploads'
    )
  }

  // Custom relative dir: still join under cwd but keep ignore so NFT does not
  // treat the repo root as an output asset. Prefer absolute LOCAL_STORAGE_DIR.
  if (root) {
    return join(root, configured)
  }
  return join(/* turbopackIgnore: true */ process.cwd(), configured)
}
