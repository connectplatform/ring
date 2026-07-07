'use server'

import { auth } from '@/auth'
import { getUserDeviceTelemetrySnapshots, getDistinctDeviceIdsForUser } from '@/features/analytics/lib/device-telemetry-db'
import type { RealtimeDataDomain } from '@/lib/tunnel/realtime-data-types'

interface SessionForensicsEntry {
  deviceId: string
  deviceLabel?: string
  browser?: string
  browserVersion?: string
  os?: string
  screenWidth?: number
  screenHeight?: number
  colorDepth?: number
  ipCountry?: string
  ipRegion?: string
  connectionType?: string
  timezone?: string
  locale?: string
  firstSeenAt?: string
  lastSeenAt?: string
}

function parseUserAgent(ua: string): { browser?: string; browserVersion?: string; os?: string } {
  if (!ua) return {}
  const result: { browser?: string; browserVersion?: string; os?: string } = {}

  // OS detection
  if (ua.includes('Mac OS')) result.os = 'macOS'
  else if (ua.includes('Windows NT')) result.os = 'Windows'
  else if (ua.includes('Linux') && !ua.includes('Android')) result.os = 'Linux'
  else if (ua.includes('Android')) result.os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) result.os = 'iOS'

  // Browser detection
  if (ua.includes('Firefox/')) {
    result.browser = 'Firefox'
    const m = ua.match(/Firefox\/(\d+)/)
    if (m) result.browserVersion = m[1]
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    result.browser = 'Chrome'
    const m = ua.match(/Chrome\/(\d+)/)
    if (m) result.browserVersion = m[1]
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    result.browser = 'Safari'
    const m = ua.match(/Version\/(\d+)/)
    if (m) result.browserVersion = m[1]
  } else if (ua.includes('Edg/')) {
    result.browser = 'Edge'
    const m = ua.match(/Edg\/(\d+)/)
    if (m) result.browserVersion = m[1]
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    result.browser = 'Opera'
  }

  return result
}

export async function getSessionForensics(): Promise<SessionForensicsEntry[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const userId = session.user.id
  const snapshots = await getUserDeviceTelemetrySnapshots(userId, { limit: 20 })

  if (!snapshots.length) return []

  // Group by deviceId, keep most recent per device
  const byDevice = new Map<string, Record<string, unknown>>()
  for (const row of snapshots) {
    const deviceId = String(row.deviceId ?? '')
    if (!deviceId || byDevice.has(deviceId)) continue
    byDevice.set(deviceId, row)
  }

  const entries: SessionForensicsEntry[] = []

  for (const [deviceId, row] of byDevice) {
    const payload = (row.payload as Record<string, unknown> | undefined) ?? {}
    const screen = (payload.screen as Record<string, unknown> | undefined) ?? {}
    const geo = (payload.geo as Record<string, unknown> | undefined) ?? {}
    const server = (row.server as Record<string, unknown> | undefined) ?? {}
    const userAgent = String(server.userAgent ?? '')
    const parsed = parseUserAgent(userAgent)

    entries.push({
      deviceId,
      deviceLabel: typeof payload.deviceLabel === 'string' ? payload.deviceLabel : undefined,
      browser: parsed.browser,
      browserVersion: parsed.browserVersion,
      os: parsed.os,
      screenWidth: typeof screen.width === 'number' ? screen.width : undefined,
      screenHeight: typeof screen.height === 'number' ? screen.height : undefined,
      colorDepth: typeof screen.colorDepth === 'number' ? screen.colorDepth : undefined,
      ipCountry: typeof server.ipCountry === 'string' ? server.ipCountry : undefined,
      ipRegion: typeof server.ipRegion === 'string' ? server.ipRegion : undefined,
      connectionType: typeof payload.connectionType === 'string' ? payload.connectionType : undefined,
      timezone: typeof payload.timezone === 'string' ? payload.timezone : undefined,
      locale: typeof payload.locale === 'string' ? payload.locale : undefined,
      firstSeenAt: typeof row.ts === 'number' ? new Date(row.ts).toISOString() : undefined,
      lastSeenAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    })
  }

  return entries
}
