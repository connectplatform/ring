import 'server-only'

import type { AnalyticsForensicsTrace } from '@/features/analytics/types/forensics-trace'

export type { AnalyticsForensicsTrace } from '@/features/analytics/types/forensics-trace'
export { getRequestForensicsContext } from '@/features/analytics/lib/request-forensics'
export {
  buildForensicsCopyPayload,
  formatForensicsTimestamp,
} from '@/features/analytics/types/forensics-trace'

function forensicsDedupeKey(trace: AnalyticsForensicsTrace): string {
  return [
    trace.kind,
    trace.message,
    trace.component ?? '',
    trace.pageUrl ?? '',
    trace.severity ?? '',
  ].join('|')
}

/** Collapse identical forensics rows; newest row wins, count aggregates occurrences. */
export function dedupeForensicsTraces(
  traces: AnalyticsForensicsTrace[],
): AnalyticsForensicsTrace[] {
  const byKey = new Map<string, AnalyticsForensicsTrace>()

  for (const trace of traces) {
    const key = forensicsDedupeKey(trace)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...trace, count: trace.count ?? 1 })
      continue
    }
    const existingTime = new Date(existing.createdAt).getTime()
    const traceTime = new Date(trace.createdAt).getTime()
    const winner = traceTime >= existingTime ? trace : existing
    const loser = winner === trace ? existing : trace
    byKey.set(key, {
      ...winner,
      count: (existing.count ?? 1) + (loser.count ?? 1),
    })
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function mapAnalyticsErrorRow(
  row: Record<string, unknown>,
): AnalyticsForensicsTrace {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  const message = String(row.message ?? 'Unknown error')
  const createdAt =
    (row.createdAt as string | undefined) ??
    (row.created_at as string | undefined) ??
    (row.timestamp as string | undefined) ??
    new Date().toISOString()

  return {
    id: String(row.id ?? `err_${Date.now()}`),
    kind: 'client_error',
    message,
    component: String(row.component ?? row.type ?? 'unknown'),
    severity: String(row.severity ?? 'error'),
    createdAt,
    pageUrl: (row.url as string | null) ?? null,
    referer:
      (row.referer as string | null) ??
      (typeof metadata.referer === 'string' ? metadata.referer : null),
    stack: (row.stack as string | null) ?? null,
    sessionId: (row.sessionId as string | null) ?? null,
    metadata: {
      ...metadata,
      environment: row.environment,
      userAgent: row.userAgent,
    },
  }
}

export function mapDocs404EventRow(
  row: Record<string, unknown>,
): AnalyticsForensicsTrace {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  const path = String(payload.path ?? payload.requestPath ?? '—')
  const referer =
    (payload.referer as string | null) ??
    (payload.originatingPath as string | null) ??
    null

  return {
    id: String(row.id ?? `docs404_${Date.now()}`),
    kind: 'docs_404',
    message: `Documentation page not found: ${path}`,
    component: 'docs_404',
    severity: 'info',
    createdAt:
      (row.recordedAt as string | undefined) ??
      (typeof row.clientTimestamp === 'number'
        ? new Date(row.clientTimestamp).toISOString()
        : undefined) ??
      (row.created_at as string | undefined) ??
      new Date().toISOString(),
    pageUrl: path,
    referer,
    originatingPath: referer,
    locale: String(payload.locale ?? '—'),
    category: (payload.category as string | null) ?? null,
    reason: String(payload.reason ?? 'missing_file'),
    metadata: {
      categoryValid: payload.categoryValid,
      requestUrl: payload.requestUrl,
      requestPath: payload.requestPath,
      ip: payload.ip,
      userAgent: payload.userAgent,
      source: payload.source,
    },
  }
}
