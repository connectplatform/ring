import type { AbuseScoreResult, AbuseSignal, AbuseSignalCode } from '@/features/fraud/types/abuse-candidate'

const SIGNAL_POINTS: Record<AbuseSignalCode, number> = {
  shared_device_fingerprint: 35,
  high_device_churn: 20,
  rapid_new_devices: 15,
  ua_screen_mismatch: 25,
  geo_ip_mismatch: 15,
  headless_profile: 30,
  no_telemetry: 10,
  new_account_collision: 20,
}

export interface TelemetryScoreInput {
  snapshots: Record<string, unknown>[]
  sharedDeviceIds: string[]
  accountCreatedAt?: string | Date | null
}

function levelFromScore(score: number): AbuseScoreResult['level'] {
  if (score >= 80) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

function pushSignal(
  signals: AbuseSignal[],
  code: AbuseSignalCode,
  detail: string,
): void {
  signals.push({ code, points: SIGNAL_POINTS[code], detail })
}

function accountAgeDays(createdAt?: string | Date | null): number {
  if (!createdAt) return 365
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime()
  if (Number.isNaN(t)) return 365
  return (Date.now() - t) / (24 * 60 * 60 * 1000)
}

function isMobileUa(ua: string): boolean {
  return /Mobi|Android|iPhone|iPod|iPad/i.test(ua)
}

function timezoneCountryHint(timezone?: string): string | undefined {
  if (!timezone) return undefined
  if (timezone.startsWith('Europe/Kyiv') || timezone.startsWith('Europe/Kiev')) return 'UA'
  if (timezone.startsWith('America/')) return 'US'
  if (timezone.startsWith('Europe/London')) return 'GB'
  return undefined
}

export function computeAbuseProbability(input: TelemetryScoreInput): AbuseScoreResult {
  const signals: AbuseSignal[] = []
  const { snapshots, sharedDeviceIds, accountCreatedAt } = input

  if (sharedDeviceIds.length > 0) {
    pushSignal(
      signals,
      'shared_device_fingerprint',
      `Device fingerprint shared with ${sharedDeviceIds.length} collision group(s)`,
    )
    if (accountAgeDays(accountCreatedAt) < 7) {
      pushSignal(signals, 'new_account_collision', 'Account younger than 7 days with shared fingerprint')
    }
  }

  const deviceIds = new Set<string>()
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  let recentNewDevices = 0

  for (const row of snapshots) {
    const deviceId = String(row.deviceId ?? '')
    if (deviceId) deviceIds.add(deviceId)

    const updatedRaw = String(row.updated_at ?? row.ts ?? '')
    const updated = Date.parse(updatedRaw)
    if (!Number.isNaN(updated) && updated >= dayAgo) {
      recentNewDevices += 1
    }

    const payload = (row.payload ?? row) as Record<string, unknown>
    const screen = (payload.screen ?? row.screen) as Record<string, unknown> | undefined
    const width = Number(screen?.width ?? 0)
    const ua = String(
      (row.server as Record<string, unknown> | undefined)?.userAgent ??
        payload.userAgent ??
        '',
    )
    const visibility = String(payload.visibility ?? row.visibility ?? 'visible')
    const timezone = String(payload.timezone ?? row.timezone ?? '')
    const locale = String(payload.locale ?? row.locale ?? '')
    const ipCountry = String(
      (row.server as Record<string, unknown> | undefined)?.ipCountry ?? '',
    )

    if (ua && isMobileUa(ua) && width >= 1024) {
      pushSignal(signals, 'ua_screen_mismatch', `Mobile UA with desktop-width screen (${width}px)`)
    }
    if (width === 0 && visibility === 'hidden') {
      pushSignal(signals, 'headless_profile', 'Zero-width screen with hidden visibility')
    }

    const tzHint = timezoneCountryHint(timezone)
    if (ipCountry && tzHint && ipCountry !== tzHint && locale && !locale.toUpperCase().includes(ipCountry)) {
      pushSignal(
        signals,
        'geo_ip_mismatch',
        `IP country ${ipCountry} vs timezone ${timezone} / locale ${locale}`,
      )
    }
  }

  if (deviceIds.size > 4) {
    const weekDevices = snapshots.filter((row) => {
      const updated = Date.parse(String(row.updated_at ?? row.ts ?? ''))
      return !Number.isNaN(updated) && updated >= weekAgo
    })
    const weekDeviceIds = new Set(weekDevices.map((r) => String(r.deviceId ?? '')).filter(Boolean))
    if (weekDeviceIds.size > 4) {
      pushSignal(signals, 'high_device_churn', `${weekDeviceIds.size} devices in 7 days`)
    }
  }

  if (recentNewDevices >= 3) {
    pushSignal(signals, 'rapid_new_devices', `${recentNewDevices} telemetry updates in 24h`)
  }

  if (snapshots.length === 0 && accountAgeDays(accountCreatedAt) > 3) {
    pushSignal(signals, 'no_telemetry', 'Active account with no device telemetry snapshots')
  }

  const score = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.points, 0),
  )

  return { score, level: levelFromScore(score), signals }
}
