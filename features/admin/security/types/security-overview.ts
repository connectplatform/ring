export const SECURITY_TABS = ['overview', 'fraud', 'verification', 'events'] as const

export type SecurityTab = (typeof SECURITY_TABS)[number]

export interface SecurityEventSummary {
  id: string
  type: string
  severity: string
  details: string
  timestamp: string
  status: string
  path?: string
}

export interface SecurityOverviewSummary {
  verificationQueueCount: number
  fraudCandidateCount: number
  highRiskFraudCount: number
  suspendedAccountCount: number
  securityEvents7d: number
  recentEvents: SecurityEventSummary[]
}

export function parseSecurityTab(value: string | null | undefined): SecurityTab {
  if (value && SECURITY_TABS.includes(value as SecurityTab)) {
    return value as SecurityTab
  }
  return 'overview'
}
