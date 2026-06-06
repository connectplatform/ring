'use client'

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw, Camera } from 'lucide-react'
import type { PublicationVersion } from '@/features/publications/types'
import { useLocale, useTranslations } from 'next-intl'
import { intlDateLocale } from '@/lib/locale-pref'

export interface VersionHistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  publicationId: string | null
  onRestore?: () => void
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  publicationId,
  onRestore
}: VersionHistoryPanelProps) {
  const t = useTranslations('editor.versionHistory')
  const locale = useLocale()
  const [versions, setVersions] = useState<PublicationVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [snapshotting, setSnapshotting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !publicationId) {
      setVersions([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/publications/${publicationId}/versions`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setVersions(json.data ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, publicationId])

  const handleRestore = async (versionId: string) => {
    if (!publicationId) return
    setRestoringId(versionId)
    setError(null)
    try {
      const res = await fetch(`/api/publications/${publicationId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', versionId })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      onOpenChange(false)
      onRestore?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoringId(null)
    }
  }

  const handleSnapshot = async () => {
    if (!publicationId) return
    setSnapshotting(true)
    setError(null)
    try {
      const res = await fetch(`/api/publications/${publicationId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', changeSummary: 'Manual snapshot' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const json = await res.json()
      if (json.data) setVersions((prev) => [json.data, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snapshot failed')
    } finally {
      setSnapshotting(false)
    }
  }

  const formatDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleString(intlDateLocale(locale), {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        {!publicationId ? (
          <p className="text-sm text-muted-foreground">{t('saveFirst')}</p>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSnapshot}
                disabled={snapshotting}
                className="gap-2"
              >
                {snapshotting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {t('saveSnapshot')}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {versions.length === 0 ? (
                  <li className="text-sm text-muted-foreground py-4">
                    {t('noVersions')}
                  </li>
                ) : (
                  versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {t('version')} {v.data.version_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(v.metadata.createdAt)}
                        </p>
                        {v.data.change_summary && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {v.data.change_summary}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(v.id)}
                        disabled={!!restoringId}
                        className="gap-1 shrink-0"
                      >
                        {restoringId === v.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        {t('restore')}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
