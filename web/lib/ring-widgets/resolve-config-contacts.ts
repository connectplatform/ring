import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { RingWidgetsContactConfig } from '@/lib/ring-config-types'
import {
  ringWidgetsContactSchema,
  type RingWidgetsContactProps,
} from '@/lib/ring-widgets/contact-schema'

/**
 * Attempts to resolve and validate the founder contact config.
 * @param config - The (optional) founder contact configuration object, possibly null.
 * @returns The strictly parsed and valid ContactProps, or null if not valid/present.
 */
export function resolveFounderContactFromConfig(
  config?: RingWidgetsContactConfig | null,
): RingWidgetsContactProps | null {
  // Return null immediately if config is not provided or nullish.
  if (!config) return null
  // Validate the config object using the Zod schema.
  const parsed = ringWidgetsContactSchema.safeParse(config)
  // Return valid parsed data if parsing succeeded, otherwise null.
  return parsed.success ? parsed.data : null
}

/**
 * Fetches the primary founder contact configuration from the current ring config snapshot,
 * parses and validates it, and returns the standardized contact props if successful.
 * Used on /about and /about-publisher pages.
 *
 * @returns Valid RingWidgetsContactProps object or null.
 */
export function getPrimaryFounderContact(): RingWidgetsContactProps | null {
  // Fetch current snapshot of config (may trigger cache or revalidation depending on implementation).
  const config = getSystemConfigSnapshot()
  // Defensive: .founders and .primary are possibly undefined, use optional chaining.
  // Pass primary founder config through strict validation routine.
  return resolveFounderContactFromConfig(config.founders?.primary)
  // TODO: If used with React 19/Next 16, consider using cache()/async data hooks
  // to leverage new data fetching and reactivity mechanisms.
}
