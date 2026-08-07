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
import { getNativeTokenSymbol } from '@/lib/ring-config-chain' // TODO: implement usage if user-beneficial.
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
import { getNativeTokenMintOrAddress } from '@/lib/ring-config-chain'

// Admin DAO management UI for viewing, editing, changing status, and deleting public pools.
export default function AdminDaoClient({
  pools,
  locale,
}: {
  pools: PublicPoolDoc[]
  locale: Locale
}) {
  // Router for navigation/refresh after actions
  const router = useRouter()
  // Main translation function for the admin DAO list
  const t = useTranslations('modules.dao.admin.list')
  // Translation function for status labels
  const tStatus = useTranslations('modules.dao.admin.status')
  // Translation function for kind labels
  const tKind = useTranslations('modules.dao.admin.kind')
  // Symbol for native token (e.g., RING or ETH)
  const nativeToken = getNativeTokenMintOrAddress('native')
  // React state: isPending indicates async action in progress, startTransition to start one
  const [isPending, startTransition] = useTransition()
  // Message state for success/error feedback to user
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // busyId tracks which pool is having an async action performed upon it (for disabling buttons/spinners)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Handler for status changes. Invoked when a pool's status is changed via the dropdown.
  const handleStatusChange = (poolId: string, status: PublicPoolDoc['status']) => {
    setBusyId(poolId)
    startTransition(async () => {
      setMessage(null) // Clear previous message
      const result = await updatePublicPoolStatusAction(poolId, status)
      if (result.success) {
        // Show success and refresh data
        setMessage({ type: 'success', text: t('statusUpdated') })
        router.refresh()
      } else {
        // Show error
        setMessage({ type: 'error', text: result.error ?? t('updateFailed') })
      }
      setBusyId(null) // Clear busy state
    })
  }

  // Handler for deleting a pool. Shows confirm, then calls delete action.
  const handleDelete = (poolId: string, title: string) => {
    // Confirm with user before deleting
    if (!confirm(t('deleteConfirm', { title }))) {
      return
    }
    setBusyId(poolId)
    startTransition(async () => {
      setMessage(null) // Clear previous message
      const result = await deletePublicPoolAction(poolId)
      if (result.success) {
        // Show success and refresh data
        setMessage({ type: 'success', text: t('deleted') })
        router.refresh()
      } else {
        // Show error
        setMessage({ type: 'error', text: result.error ?? t('deleteFailed') })
      }
      setBusyId(null)
    })
  }

  // UI rendering
  return (
    <div className="space-y-6">
      {/* Header section with page title, description, and create pool button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          {/* Button to navigate to Create New Pool form */}
          <Link href={toAppHref(ROUTES.ADMIN_DAO_CREATE(locale))}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {t('createPool')}
          </Link>
        </Button>
      </div>

      {/* Show success/error message after actions */}
      {message ? (
        <p
          className={
            message.type === 'success' ? 'text-sm text-green-600' : 'text-sm text-destructive'
          }
        >
          {message.text}
        </p>
      ) : null}

      {/* Pool summary statistics */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total number of pools */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('totalPools')}</CardDescription>
            <CardTitle className="text-2xl">{pools.length}</CardTitle>
          </CardHeader>
        </Card>
        {/* Pools in queued or in progress status */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('queuedInProgress')}</CardDescription>
            <CardTitle className="text-2xl">
              {pools.filter((p) => p.status === 'queued' || p.status === 'in_progress').length}
            </CardTitle>
          </CardHeader>
        </Card>
        {/* Pools with completed status */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('completed')}</CardDescription>
            <CardTitle className="text-2xl">
              {pools.filter((p) => p.status === 'completed').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main pools table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allPools')}</CardTitle>
          <CardDescription>
            {t('allPoolsDescription')}{' '}
            {/* Link to the main DAO page */}
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
                // Show empty state if there are no pools
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                // Map each pool to a row
                pools.map((pool) => {
                  // Calculate funding progress as a percent
                  const fundingPct = fundingProgressPct(pool.pledged_native_token, pool.goal_native_token)
                  return (
                    <TableRow key={pool.id}>
                      {/* Pool title and slug */}
                      <TableCell>
                        <div className="font-medium">{pool.title}</div>
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {pool.pool_slug}
                        </div>
                      </TableCell>
                      {/* Pool kind (translated label) */}
                      <TableCell className="text-xs">{tKind(pool.pool_kind)}</TableCell>
                      {/* Like count */}
                      <TableCell>{pool.like_count}</TableCell>
                      {/* Funding progress: pledged/goal, token, and percent */}
                      <TableCell>
                        <span className="text-xs tabular-nums">
                          {pool.pledged_native_token}/{pool.goal_native_token} {nativeToken} ({fundingPct}%)
                        </span>
                      </TableCell>
                      {/* Status dropdown for changing pool status */}
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
                      {/* Row actions: edit, view, delete */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Edit button (admin edit page) */}
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={toAppHref(ROUTES.ADMIN_DAO_EDIT(pool.id, locale))}>
                              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {t('edit')}
                            </Link>
                          </Button>
                          {/* View button (public view, opens in new tab) */}
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
                          {/* Delete button (calls handleDelete) */}
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
