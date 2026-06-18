import { getRingConfigSnapshot } from '@/lib/ring-config-core'
import type { RingWidgetsContactConfig } from '@/lib/ring-config-types'
import {
  ringWidgetsContactSchema,
  type RingWidgetsContactProps,
} from '@/lib/ring-widgets/contact-schema'

export function resolveFounderContactFromConfig(
  config?: RingWidgetsContactConfig | null,
): RingWidgetsContactProps | null {
  if (!config) return null
  const parsed = ringWidgetsContactSchema.safeParse(config)
  return parsed.success ? parsed.data : null
}

/** Primary founder contact from ring-config.json — used on /about and /about-publisher. */
export function getPrimaryFounderContact(): RingWidgetsContactProps | null {
  const config = getRingConfigSnapshot()
  return resolveFounderContactFromConfig(config.founders?.primary)
}
