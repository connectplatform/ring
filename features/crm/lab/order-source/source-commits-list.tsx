'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'

export type SourceCommitRow = {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  date: string
  url: string
}

type CommitDetail = SourceCommitRow & {
  files: Array<{
    filename: string
    status: string
    additions?: number
    deletions?: number
    patch?: string
  }>
}

export function SourceCommitsList({
  orderId,
  commits,
}: {
  orderId: string
  commits: SourceCommitRow[]
}) {
  const t = useTranslations('calculator')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (sha: string) => {
    if (expanded === sha) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(sha)
    setError(null)
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          commit?: CommitDetail
        }>(`/api/my-jobs/${orderId}/source/commits/${sha}`)
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to load commit')
        if (data.error) throw new Error(data.error)
        setDetail(data.commit || null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
        setDetail(null)
      }
    })
  }

  if (!commits.length) {
    return <p className="text-sm text-muted-foreground">{t('order.source.noCommits')}</p>
  }

  return (
    <ul className="space-y-2">
      {commits.map((c) => {
        const open = expanded === c.sha
        return (
          <li key={c.sha} className="rounded-md border">
            <button
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
              type="button"
              onClick={() => toggle(c.sha)}
            >
              {open ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.message.split('\n')[0]}</p>
                <p className="text-xs text-muted-foreground">
                  <Badge className="mr-1 font-mono" variant="outline">
                    {c.sha.slice(0, 7)}
                  </Badge>
                  {c.authorName}
                  {c.date ? ` · ${new Date(c.date).toLocaleString()}` : ''}
                </p>
              </div>
            </button>
            {open ? (
              <div className="border-t bg-muted/20 px-3 py-2">
                {pending && !detail ? (
                  <div className="flex items-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  </div>
                ) : null}
                {error && expanded === c.sha ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : null}
                {detail && detail.sha === c.sha ? (
                  <div className="space-y-2">
                    {detail.files.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('order.source.diff')}</p>
                    ) : (
                      detail.files.map((f) => (
                        <div key={f.filename} className="space-y-1">
                          <p className="font-mono text-xs">
                            {f.filename}{' '}
                            <span className="text-muted-foreground">({f.status})</span>
                          </p>
                          {f.patch ? (
                            <pre className="max-h-48 overflow-auto rounded border bg-background p-2 font-mono text-[11px] leading-relaxed">
                              {f.patch}
                            </pre>
                          ) : null}
                        </div>
                      ))
                    )}
                    {detail.url ? (
                      <Button asChild size="sm" variant="link">
                        <a href={detail.url} rel="noreferrer" target="_blank">
                          Forgejo
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
