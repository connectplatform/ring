'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import { PUBLIC_POOL_STATUSES } from '@/lib/zod/public-pool-schemas'
import {
  deletePublicPoolAction,
  updatePublicPoolStatusAction,
} from '@/app/_actions/admin-dao'
import { fundingProgressPct } from '@/lib/public-pools/goal-ring'
import { getRingTokenSymbol } from '@/lib/ring-config-core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'

export default function AdminDaoClient({
  pools,
  locale,
}: {
  pools: PublicPoolDoc[]
  locale: Locale
}) {
  const router = useRouter()
  const t = useTranslations('modules.dao.admin.list')
  const tStatus = useTranslations('modules.dao.admin.status')
  const tKind = useTranslations('modules.dao.admin.kind')
  const nativeToken = getRingTokenSymbol()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleStatusChange = (poolId: string, status: PublicPoolDoc['status']) => {
    setBusyId(poolId)
    startTransition(async () => {
      setMessage(null)
      const result = await updatePublicPoolStatusAction(poolId, status)
      if (result.success) {
        setMessage({ type: 'success', text: t('statusUpdated') })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error ?? t('updateFailed') })
      }
      setBusyId(null)
    })
  }

  const handleDelete = (poolId: string, title: string) => {
    if (!confirm(t('deleteConfirm', { title }))) {
      return
    }
    setBusyId(poolId)
    startTransition(async () => {
      setMessage(null)
      const result = await deletePublicPoolAction(poolId)
      if (result.success) {
        setMessage({ type: 'success', text: t('deleted') })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error ?? t('deleteFailed') })
      }
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href={toAppHref(ROUTES.ADMIN_DAO_CREATE(locale))}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('createPool')}
          </Link>
        </Button>
      </div>

      {message ? (
        <p
          className={
            message.type === 'success' ? 'text-sm text-green-600' : 'text-sm text-destructive'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('totalPools')}</CardDescription>
            <CardTitle className="text-2xl">{pools.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('queuedInProgress')}</CardDescription>
            <CardTitle className="text-2xl">
              {pools.filter((p) => p.status === 'queued' || p.status === 'in_progress').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('completed')}</CardDescription>
            <CardTitle className="text-2xl">
              {pools.filter((p) => p.status === 'completed').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allPools')}</CardTitle>
          <CardDescription>
            {t('allPoolsDescription')}{' '}
            <Link href={toAppHref(ROUTES.DAO(locale))} className="underline">
              /dao
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableTitle')}</TableHead>
                <TableHead>{t('tableKind')}</TableHead>
                <TableHead>{t('tableLikes')}</TableHead>
                <TableHead>{t('tableFunding')}</TableHead>
                <TableHead>{t('tableStatus')}</TableHead>
                <TableHead className="text-right">{t('tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                pools.map((pool) => {
                  const fundingPct = fundingProgressPct(pool.pledged_ring, pool.goal_ring)
                  return (
                    <TableRow key={pool.id}>
                      <TableCell>
                        <div className="font-medium">{pool.title}</div>
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {pool.pool_slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{tKind(pool.pool_kind)}</TableCell>
                      <TableCell>{pool.like_count}</TableCell>
                      <TableCell>
                        <span className="text-xs tabular-nums">
                          {pool.pledged_ring}/{pool.goal_ring} {nativeToken} ({fundingPct}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={pool.status}
                          disabled={isPending && busyId === pool.id}
                          onValueChange={(value) =>
                            handleStatusChange(pool.id, value as PublicPoolDoc['status'])
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PUBLIC_POOL_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {tStatus(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={toAppHref(ROUTES.ADMIN_DAO_EDIT(pool.id, locale))}>
                              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {t('edit')}
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={toAppHref(ROUTES.DAO_POOL(pool.pool_slug, locale))}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {t('view')}
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending && busyId === pool.id}
                            onClick={() => handleDelete(pool.id, pool.title)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
