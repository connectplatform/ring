/** Shared forensics shape for client errors and docs 404 rows in admin analytics. */
export interface AnalyticsForensicsTrace {
  id: string
  kind: 'client_error' | 'docs_404'
  message: string
  /** Occurrence count when deduplicated in admin list */
  count?: number
  createdAt: string
  severity?: string
  component?: string
  pageUrl?: string | null
  referer?: string | null
  originatingPath?: string | null
  stack?: string | null
  sessionId?: string | null
  locale?: string
  category?: string | null
  reason?: string
  metadata?: Record<string, unknown>
}

export function formatForensicsTimestamp(iso: string, locale = 'en'): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return iso
  }
}

/**
 * Clipboard payload for admin forensics.
 * Backlog: transform into a "Fix" flow — build a LegioX prompt and POST to
 * `ringdom.org/api/reports/$projectName` for broader analysis in Ringdom nexus.
 */
export function buildForensicsCopyPayload(trace: AnalyticsForensicsTrace): string {
  return JSON.stringify(
    {
      _ringdom_backlog:
        'Copy-to-buffer for admin. Future: Fix button → forensics prompt → POST ringdom.org/api/reports/$projectName',
      exportedAt: new Date().toISOString(),
      ...trace,
    },
    null,
    2,
  )
}
