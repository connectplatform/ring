export type AbuseRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type AbuseSignalCode =
  | 'shared_device_fingerprint'
  | 'high_device_churn'
  | 'rapid_new_devices'
  | 'ua_screen_mismatch'
  | 'geo_ip_mismatch'
  | 'headless_profile'
  | 'no_telemetry'
  | 'new_account_collision'

export interface AbuseSignal {
  code: AbuseSignalCode
  points: number
  detail: string
}

export interface AbuseScoreResult {
  score: number
  level: AbuseRiskLevel
  signals: AbuseSignal[]
}

export interface AbuseCandidate {
  userId: string
  email?: string
  name?: string | null
  accountStatus: string
  createdAt?: string
  score: number
  level: AbuseRiskLevel
  signals: AbuseSignal[]
  deviceCount: number
  lastTelemetryAt?: string
  sharedDeviceIds?: string[]
}
