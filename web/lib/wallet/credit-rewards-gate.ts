/**
 * Global credit-balance-add reward kill switch.
 *
 * ring-config SSOT: `credit.rewards.enabled` (singular). Legacy dual-read:
 * `credits.rewards.enabled`. Omitted / undefined = enabled (backward compatible).
 * Does not gate credit purchase, MCP admin mint, or referral token minting.
 */

function coerceEnabledFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 0) return false
    if (value === 1) return true
    return undefined
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') {
      return false
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') {
      return true
    }
  }
  return undefined
}

export function resolveCreditRewardsEnabled(
  creditRewards?: { enabled?: unknown } | null,
  creditsRewards?: { enabled?: unknown } | null,
): boolean {
  const primary = coerceEnabledFlag(creditRewards?.enabled)
  if (typeof primary === 'boolean') return primary
  const legacy = coerceEnabledFlag(creditsRewards?.enabled)
  if (typeof legacy === 'boolean') return legacy
  return true
}
