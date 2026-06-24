'use client'

import React, { useCallback, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import type { AnalyticsForensicsTrace } from '@/features/analytics/types/forensics-trace'
import {
  buildForensicsCopyPayload,
  formatForensicsTimestamp,
} from '@/features/analytics/types/forensics-trace'

interface AnalyticsForensicsRowProps {
  trace: AnalyticsForensicsTrace
  badgeLabel?: string
}

export function AnalyticsForensicsRow({ trace, badgeLabel }: AnalyticsForensicsRowProps) {
  const locale = useLocale()
  const t = useTranslations('modules.admin.webAnalytics.forensics')
  const [copied, setCopied] = useState(false)

  const onCopyTrace = useCallback(async () => {
    const payload = buildForensicsCopyPayload(trace)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback for non-secure contexts */
      const textarea = document.createElement('textarea')
      textarea.value = payload
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }, [trace])

  const badge =
    badgeLabel ??
    (trace.kind === 'docs_404' ? 'docs_404' : trace.component ?? trace.severity ?? 'error')

  return (
    <div className="rounded-lg border p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium break-words">
            {trace.message}
            {(trace.count ?? 1) > 1 ? (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({trace.count})
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatForensicsTimestamp(trace.createdAt, locale)}
            {trace.locale ? ` · ${trace.locale}` : ''}
            {trace.reason ? ` · ${trace.reason}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{badge}</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void onCopyTrace()}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">{copied ? t('copied') : t('copyTrace')}</span>
          </Button>
        </div>
      </div>

      {trace.pageUrl ? (
        <p className="text-xs break-all">
          <span className="font-medium text-foreground">{t('pageUrl')}: </span>
          <span className="text-muted-foreground">{trace.pageUrl}</span>
        </p>
      ) : null}

      {trace.referer ? (
        <p className="text-xs break-all">
          <span className="font-medium text-foreground">{t('referer')}: </span>
          <span className="text-muted-foreground">{trace.referer}</span>
        </p>
      ) : null}

      {trace.stack && trace.kind === 'client_error' ? (
        <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] leading-snug text-muted-foreground">
          {trace.stack.split('\n').slice(0, 6).join('\n')}
        </pre>
      ) : null}
    </div>
  )
}
