'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { getLocalizedPipelineCopy } from '@/features/admin/processes/pipeline-i18n'
import type { Locale } from '@/i18n/shared'
import type { PipelineSummary, ProcessRunRecord } from '@/lib/processes/types'
import {
  Activity,
  AlertTriangle,
  Clock,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react'

interface ProcessesClientProps {
  locale: Locale
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success':
      return 'default'
    case 'running':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'outline'
  }
}

function formatWhen(iso: string | undefined, locale: string) {
  if (!iso) return '—'
  try {
    const intlLocale =
      locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US'
    return new Date(iso).toLocaleString(intlLocale)
  } catch {
    return iso
  }
}

export function ProcessesClient({ locale }: ProcessesClientProps) {
  const t = useTranslations('modules.admin.processes')
  const activeLocale = useLocale()
  const tAdmin = useTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(tAdmin)

  const [pipelines, setPipelines] = useState<PipelineSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, ProcessRunRecord[]>>({})

  const loadPipelines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/processes', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || t('loadError'))
      }
      setPipelines(json.pipelines ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadHistory = useCallback(async (pipelineId: string) => {
    try {
      const res = await fetch(`/api/admin/processes/${pipelineId}/history?limit=10`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (res.ok) {
        setHistory((prev) => ({ ...prev, [pipelineId]: json.runs ?? [] }))
      }
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    void loadPipelines()
    const interval = setInterval(() => void loadPipelines(), 30_000)
    return () => clearInterval(interval)
  }, [loadPipelines])

  const handleRun = async (pipelineId: string) => {
    setRunningId(pipelineId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/processes/${pipelineId}/run`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || t('runError'))
      }
      await loadPipelines()
      await loadHistory(pipelineId)
      setExpandedId(pipelineId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('runError'))
    } finally {
      setRunningId(null)
    }
  }

  const toggleHistory = async (pipelineId: string) => {
    if (expandedId === pipelineId) {
      setExpandedId(null)
      return
    }
    setExpandedId(pipelineId)
    await loadHistory(pipelineId)
  }

  return (
    <AdminWrapper locale={locale} pageContext="processes" labels={adminLabels}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-8 w-8" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => void loadPipelines()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && pipelines.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pipelines.map((pipeline) => {
              const latest = pipeline.latestRun
              const isRunning = runningId === pipeline.id || latest?.status === 'running'
              const copy = getLocalizedPipelineCopy(t, pipeline.id)
              return (
                <Card key={pipeline.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{copy.label}</CardTitle>
                      <p className="text-sm text-muted-foreground">{copy.description}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline">{t(`categories.${pipeline.category}`)}</Badge>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {copy.schedule}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {pipeline.cronPath}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={statusVariant(latest?.status)}>
                        {latest?.status ? t(`status.${latest.status}`) : t('status.never')}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => void handleRun(pipeline.id)}
                        disabled={isRunning}
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {t('runNow')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('lastRun')}: </span>
                        <span>{formatWhen(latest?.finishedAt ?? latest?.startedAt, activeLocale)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('duration')}: </span>
                        <span>
                          {latest?.durationMs != null ? `${latest.durationMs}ms` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('trigger')}: </span>
                        <span>{latest?.trigger ? t(`triggers.${latest.trigger}`) : '—'}</span>
                      </div>
                    </div>
                    {latest?.error && (
                      <p className="text-sm text-destructive">{latest.error}</p>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => void toggleHistory(pipeline.id)}>
                      {expandedId === pipeline.id ? t('hideHistory') : t('showHistory')}
                    </Button>
                    {expandedId === pipeline.id && (
                      <div className="rounded-md border p-3 space-y-2 text-sm">
                        {(history[pipeline.id] ?? []).length === 0 ? (
                          <p className="text-muted-foreground">{t('noHistory')}</p>
                        ) : (
                          (history[pipeline.id] ?? []).map((run) => (
                            <div
                              key={run.id}
                              className="flex flex-wrap items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0"
                            >
                              <span>{formatWhen(run.finishedAt ?? run.startedAt, activeLocale)}</span>
                              <Badge variant={statusVariant(run.status)}>
                                {t(`status.${run.status}`)}
                              </Badge>
                              <span className="text-muted-foreground">
                                {run.durationMs != null ? `${run.durationMs}ms` : '—'}
                              </span>
                              {run.error && (
                                <span className="text-destructive w-full">{run.error}</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AdminWrapper>
  )
}
