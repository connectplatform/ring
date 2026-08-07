import 'server-only'

import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

const FALLBACK_ENABLED_TYPES = [
  'offer',
  'request',
  'partnership',
  'volunteer',
  'mentorship',
  'resource',
  'event',
  'cv',
  'program',
  'ring_customization',
  'scheduled_services',
  'collective_order',
  'bounty',
  'tender',
  'asset_rental',
  'job',
] as const

/** ring-config.json → opportunities.enabledTypes (white-label gate). */
export function getEnabledOpportunityTypes(): string[] {
  try {
    const cfg = getSystemConfigSnapshot() as {
      opportunities?: { enabledTypes?: string[] }
    }
    const list = cfg.opportunities?.enabledTypes
    if (Array.isArray(list) && list.length > 0) {
      return list.map(String).filter(Boolean)
    }
  } catch {
    // fall through
  }
  return [...FALLBACK_ENABLED_TYPES]
}

export function isOpportunityTypeEnabled(type: string): boolean {
  return getEnabledOpportunityTypes().includes(type)
}
