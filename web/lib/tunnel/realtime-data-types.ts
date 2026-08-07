/**
 * Realtime telemetry domains — separate from NotificationType inbox events.
 * Tunnel-only (no FCM); active when WSS session is up.
 */

export type RealtimeDataDomain =
  | 'geo'
  | 'weather'
  | 'aux'
  | 'biometrics'
  | 'presence'
  | 'device_health'

export interface RealtimeDataMessage {
  domain: RealtimeDataDomain
  deviceId: string
  ts: number
  payload: Record<string, unknown>
}

export const REALTIME_DATA_DOMAINS: RealtimeDataDomain[] = [
  'geo',
  'weather',
  'aux',
  'biometrics',
  'presence',
  'device_health',
]

export function telemetryChannelForDomain(domain: RealtimeDataDomain): string {
  return `telemetry:${domain}`
}

export function telemetryUplinkChannel(): string {
  return 'telemetry:uplink'
}
