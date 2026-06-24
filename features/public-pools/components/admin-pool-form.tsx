'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, toAppHref, useRouter } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import {
  PUBLIC_POOL_FUNDING_MODES,
  PUBLIC_POOL_KINDS,
  PUBLIC_POOL_STATUSES,
} from '@/lib/zod/public-pool-schemas'
import {
  createPublicPoolAction,
  updatePublicPoolAction,
} from '@/app/_actions/admin-dao'
import { getRingTokenSymbol } from '@/lib/ring-config-core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AdminPoolForm({
  mode,
  locale,
  pool,
}: {
  mode: 'create' | 'edit'
  locale: Locale
  pool?: PublicPoolDoc
}) {
  const router = useRouter()
  const t = useTranslations('modules.dao.admin.form')
  const tStatus = useTranslations('modules.dao.admin.status')
  const tKind = useTranslations('modules.dao.admin.kind')
  const tFunding = useTranslations('modules.dao.admin.fundingMode')
  const nativeToken = getRingTokenSymbol()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      setError(null)
      const result =
        mode === 'create'
          ? await createPublicPoolAction(formData)
          : await updatePublicPoolAction(pool!.id, formData)

      if (result.success) {
        if (mode === 'create' && 'poolId' in result && typeof result.poolId === 'string') {
          router.push({
            pathname: '/admin/dao/edit/[id]',
            params: { id: result.poolId },
          })
        } else {
          router.push('/admin/dao')
        }
        router.refresh()
      } else {
        setError(result.error ?? t('saveFailed'))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">{t('titleLabel')}</Label>
        <Input id="title" name="title" required defaultValue={pool?.title ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionLabel')}</Label>
        <Textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={pool?.description ?? ''}
        />
      </div>

      {mode === 'create' ? (
        <div className="space-y-2">
          <Label htmlFor="pool_slug">{t('poolSlugOptional')}</Label>
          <Input
            id="pool_slug"
            name="pool_slug"
            placeholder={t('poolSlugPlaceholder')}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t('poolSlugReadonly')}</Label>
          <Input value={pool?.pool_slug ?? ''} readOnly disabled className="font-mono text-xs" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pool_kind">{t('kindLabel')}</Label>
          <Select name="pool_kind" defaultValue={pool?.pool_kind ?? 'future_feature'}>
            <SelectTrigger id="pool_kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLIC_POOL_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {tKind(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal_hours">{t('goalHoursLabel')}</Label>
          <Input
            id="goal_hours"
            name="goal_hours"
            type="number"
            min={1}
            required
            defaultValue={pool?.goal_hours ?? 1}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="funding_mode">{t('fundingModeLabel')}</Label>
          <Select name="funding_mode" defaultValue={pool?.funding_mode ?? 'donation'}>
            <SelectTrigger id="funding_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLIC_POOL_FUNDING_MODES.map((fundingMode) => (
                <SelectItem key={fundingMode} value={fundingMode}>
                  {tFunding(fundingMode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{t('statusLabel')}</Label>
          <Select name="status" defaultValue={pool?.status ?? 'open'}>
            <SelectTrigger id="status">
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
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc_path">{t('docPathLabel')}</Label>
        <Input
          id="doc_path"
          name="doc_path"
          placeholder={t('docPathPlaceholder')}
          defaultValue={pool?.doc_path ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="labels">{t('labelsLabel')}</Label>
        <Input
          id="labels"
          name="labels"
          defaultValue={(pool?.labels ?? []).join(', ')}
          placeholder={t('labelsPlaceholder')}
        />
      </div>

      {mode === 'edit' && pool ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>{t('likesCount', { count: pool.like_count })}</p>
          <p>
            {t('pledgedSummary', {
              pledged: pool.pledged_ring,
              goal: pool.goal_ring,
              token: nativeToken,
            })}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : mode === 'create' ? t('createPool') : t('saveChanges')}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={toAppHref(ROUTES.ADMIN_DAO(locale))}>{t('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
