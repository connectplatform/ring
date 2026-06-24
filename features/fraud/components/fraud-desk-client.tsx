'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, ShieldAlert, Ban, Eye } from 'lucide-react'
import type { AbuseCandidate } from '@/features/fraud/types/abuse-candidate'
import { Link } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

function scoreBadgeVariant(level: AbuseCandidate['level']) {
  switch (level) {
    case 'critical':
      return 'destructive' as const
    case 'high':
      return 'destructive' as const
    case 'medium':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

export function FraudDeskClient({ locale }: { locale: Locale }) {
  const t = useTranslations('modules.admin.fraudDesk')
  const [candidates, setCandidates] = useState<AbuseCandidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<{
    snapshots: Record<string, unknown>[]
    score: { score: number; level: string; signals: AbuseCandidate['signals'] }
  } | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AbuseCandidate | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/fraud/candidates?limit=50&minScore=1', {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setCandidates(data.candidates ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    startTransition(() => void load())
  }, [load])

  const openDetail = async (userId: string) => {
    setDetailUserId(userId)
    setDetailData(null)
    try {
      const res = await fetch(`/api/admin/fraud/users/${encodeURIComponent(userId)}/telemetry`)
      const data = await res.json()
      if (res.ok) {
        setDetailData({ snapshots: data.snapshots, score: data.score })
      }
    } catch {
      // ignore
    }
  }

  const confirmSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return
    setActionMessage(null)
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(suspendTarget.userId)}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SUSPENDED',
            reason: suspendReason.trim(),
            fraudScore: suspendTarget.score,
            signals: suspendTarget.signals,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Suspend failed')
      setActionMessage(t('suspendSuccess', { email: suspendTarget.email ?? suspendTarget.userId }))
      setSuspendTarget(null)
      setSuspendReason('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suspend failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => startTransition(() => void load())} disabled={isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {actionMessage && (
        <Alert>
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('candidatesTitle')}</CardTitle>
          <CardDescription>{t('candidatesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 && !isPending ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colScore')}</TableHead>
                  <TableHead>{t('colUser')}</TableHead>
                  <TableHead>{t('colSignals')}</TableHead>
                  <TableHead>{t('colDevices')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.userId}>
                    <TableCell>
                      <Badge variant={scoreBadgeVariant(c.level)}>
                        {c.score} · {c.level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{c.email ?? c.userId}</div>
                      {c.name && <div className="text-xs text-muted-foreground">{c.name}</div>}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {c.signals.slice(0, 3).map((s) => (
                          <li key={s.code}>{s.detail}</li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>{c.deviceCount}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openDetail(c.userId)}>
                        <Eye className="h-3 w-3 mr-1" />
                        {t('detail')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSuspendTarget(c)
                          setSuspendReason(
                            t('defaultSuspendReason', {
                              signals: c.signals.map((s) => s.code).join(', '),
                            }),
                          )
                        }}
                      >
                        <Ban className="h-3 w-3 mr-1" />
                        {t('suspend')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t('verificationHint')}{' '}
        <Link href="/admin/verification" className="text-primary underline">
          {t('verificationLink')}
        </Link>
      </p>

      <Dialog open={!!detailUserId} onOpenChange={(open) => !open && setDetailUserId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('telemetryTitle')}</DialogTitle>
            <DialogDescription>{detailUserId}</DialogDescription>
          </DialogHeader>
          {detailData?.score && (
            <div className="text-sm">
              <Badge>{detailData.score.score} — {detailData.score.level}</Badge>
            </div>
          )}
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
            {JSON.stringify(detailData?.snapshots ?? [], null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('suspendTitle')}</DialogTitle>
            <DialogDescription>
              {suspendTarget?.email ?? suspendTarget?.userId}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full min-h-[100px] rounded-md border bg-background p-3 text-sm"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder={t('suspendReasonPlaceholder')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmSuspend} disabled={!suspendReason.trim()}>
              {t('confirmSuspend')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
