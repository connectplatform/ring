import { join } from 'node:path'

// Extract process.cwd() to a module-level variable so Turbopack's AST tracer
// recognizes the turbopackIgnore annotation at the declaration site. Inline
// comments inside join() arguments are NOT recognized by the tracer.
/* turbopackIgnore: true */ const PROJECT_ROOT = process.cwd()

export type ResolveLocalStorageRootOptions = {
  /** Project root; defaults to `process.cwd()`. */
  cwd?: string
  /**
   * When set, used instead of `LOCAL_STORAGE_DIR` and the default `public/uploads`.
   * Relative paths are resolved under `cwd`.
   */
  configuredDir?: string
}

/**
 * Absolute filesystem directory where local file keys are stored (e.g. `refmagic/outputs/...`).
 * Must stay aligned with {@link LocalStorageAdapter} and any route that reads the same files.
 */
export function resolveLocalStorageRoot(
  options?: ResolveLocalStorageRootOptions
): string {
  let configured =
    options?.configuredDir ??
    process.env.LOCAL_STORAGE_DIR ??
    'public/uploads'

  if (!configured || configured.trim() === '') {
    configured = 'public/uploads'
  }

  if (configured.startsWith('/')) {
    return configured
  }

  const root = options?.cwd
  if (root) {
    return join(root, configured)
  }
  return join(/* turbopackIgnore: true */ PROJECT_ROOT, configured)
}
