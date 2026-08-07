import 'server-only'

import { getRecentDocsSecurityEvents } from '@/features/analytics/lib/docs-analytics'
import { listAbuseCandidates } from '@/features/fraud/services/fraud-abuse-scoring'
import { getVerificationQueue } from '@/features/verification/services/get-verification-queue'
import { db } from '@/lib/database'
import { normalizeAccountStatus } from '@/features/auth/lib/account-status'
import type { SecurityOverviewSummary } from '@/features/admin/security/types/security-overview'

export async function getSecurityOverview(): Promise<SecurityOverviewSummary> {
  const [verificationQueue, fraudCandidates, recentEvents, suspendedResult] = await Promise.all([
    getVerificationQueue(),
    listAbuseCandidates({ limit: 100, minScore: 1 }),
    getRecentDocsSecurityEvents(20),
    db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'account_status', operator: '==', value: 'SUSPENDED' }],
      pagination: { limit: 500 },
    }),
  ])

  const suspendedFromFilter = suspendedResult.success ? suspendedResult.data?.length ?? 0 : 0

  let suspendedAccountCount = suspendedFromFilter
  if (suspendedAccountCount === 0) {
    const allUsers = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      pagination: { limit: 1000 },
    })
    if (allUsers.success && allUsers.data) {
      suspendedAccountCount = allUsers.data.filter(
        (row) => normalizeAccountStatus(String(row.account_status ?? '')) === 'SUSPENDED',
      ).length
    }
  }

  const highRiskFraudCount = fraudCandidates.filter(
    (c) => c.level === 'high' || c.level === 'critical',
  ).length

  return {
    verificationQueueCount: verificationQueue.length,
    fraudCandidateCount: fraudCandidates.length,
    highRiskFraudCount,
    suspendedAccountCount,
    securityEvents7d: recentEvents.length,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      details: event.details,
      timestamp: event.timestamp,
      status: event.status,
      path: event.path,
    })),
  }
}
