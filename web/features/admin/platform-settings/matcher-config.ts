import { getMatcherInstallDefaults } from '@/lib/ring-config-core'
import type { PlatformAIData } from '@/features/admin/platform-settings/types'

function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

/** Env + ring-config install defaults for matcher (used when DB disabled or seeding). */
export function resolveMatcherConfigFromEnv(): PlatformAIData['matcher'] {
  const defaults = getMatcherInstallDefaults()
  return {
    scoreThreshold: Number.parseFloat(
      process.env.MATCHING_SCORE_THRESHOLD || String(defaults.scoreThreshold),
    ),
    maxMatches: Number.parseInt(
      process.env.MAX_MATCHES_PER_OPPORTUNITY || String(defaults.maxMatches),
      10,
    ),
    autoApprove: parseEnvBoolean(process.env.MATCHER_AUTO_APPROVE, defaults.autoApprove),
    autoApproveMinScore: Number.parseFloat(
      process.env.MATCHER_AUTO_APPROVE_MIN_SCORE || String(defaults.autoApproveMinScore),
    ),
  }
}
