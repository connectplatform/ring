import { join } from 'node:path'

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
    join('public', 'uploads')

  if (!configured || configured.trim() === '') {
    configured = join('public', 'uploads')
  }

  if (configured.startsWith('/')) {
    return configured
  }

  const root = options?.cwd
  if (root) {
    return join(root, configured)
  }
  return join(/* turbopackIgnore: true */ process.cwd(), configured)
}
