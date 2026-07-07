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
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
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

// TODO: Switch from useTransition to useFormStatus (React 19 / Next 16) for native async form state handling.
// This will make pending state tracking more idiomatic in server actions or form submits.
// See: https://react.dev/reference/react-dom/hooks/useFormStatus

/**
 * AdminPoolForm component is responsible for rendering a form
 * used by administrators for both creating and editing Public Pools.
 * 
 * PROPS
 * - mode: Determines form create/edit behavior ('create' | 'edit')
 * - locale: App language locale
 * - pool: Optional; If in 'edit' mode, passes the existing pool doc
 */
export function AdminPoolForm({
  mode,     // 'create' or 'edit'
  locale,   // User's locale
  pool,     // Pool object if editing, otherwise undefined
}: {
  mode: 'create' | 'edit'
  locale: Locale
  pool?: PublicPoolDoc
}) {
  const router = useRouter()
  // Translation hooks for form, status, kind, and funding mode fields
  const t = useTranslations('modules.dao.admin.form')
  const tStatus = useTranslations('modules.dao.admin.status')
  const tKind = useTranslations('modules.dao.admin.kind')
  const tFunding = useTranslations('modules.dao.admin.fundingMode')
  // Retrieves the native network token symbol, e.g., "RING"
  const nativeToken = getNativeTokenSymbol()
  // Tracks async/pending state for handling form submissions
  const [isPending, startTransition] = useTransition()
  // Local error message state for displaying submission errors
  const [error, setError] = useState<string | null>(null)

  /**
   * Form submit handler.
   * Prevents default, builds FormData, clears previous errors,
   * and performs the correct async action (create or update).
   * Handles redirection and error display as a transition (non-blocking).
   * 
   * TODO: Migrate to useFormStatus when server actions/forms are used,
   * or if adopting React 19+ and Next.js 16+ idioms.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      setError(null) // Reset any previous error message before submit

      // Submit form; choose action depending on mode
      const result =
        mode === 'create'
          ? await createPublicPoolAction(formData)
          : await updatePublicPoolAction(pool!.id, formData) // pool should always exist if edit mode

      if (result.success) {
        // On success, route the user accordingly:
        if (mode === 'create' && 'poolId' in result && typeof result.poolId === 'string') {
          // If a new pool is created, navigate directly to its edit page
          router.push({
            pathname: '/admin/dao/edit/[id]',
            params: { id: result.poolId },
          })
        } else {
          // Otherwise (edit mode), navigate to the pools list
          router.push('/admin/dao')
        }
        // Force data refresh for correctness
        router.refresh()
      } else {
        // If unsuccessful, show translated or fallback error message
        setError(result.error ?? t('saveFailed'))
      }
    })
  }

  // UI RENDER
  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {/* Title input; required field, shows current title if editing */}
      <div className="space-y-2">
        <Label htmlFor="title">{t('titleLabel')}</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={pool?.title ?? ''}
        />
      </div>

      {/* Description textarea; required field, shows existing description if editing */}
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

      {/* Pool slug: editable when creating; readonly and disabled otherwise */}
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
          <Input
            value={pool?.pool_slug ?? ''}
            readOnly
            disabled
            className="font-mono text-xs"
          />
        </div>
      )}

      {/* Kind and Goal Hours inputs shown side-by-side on larger screens */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Pool Kind: select field, required; pre-selects pool's kind if editing */}
        <div className="space-y-2">
          <Label htmlFor="pool_kind">{t('kindLabel')}</Label>
          <Select
            name="pool_kind"
            defaultValue={pool?.pool_kind ?? 'future_feature'}
          >
            <SelectTrigger id="pool_kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Each kind is translated and rendered as an option */}
              {PUBLIC_POOL_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {tKind(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pool Goal Hours: number input, min 1, required */}
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

      {/* Funding mode and Status selects side by side */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Funding Mode field; select from constants, default to 'donation' */}
        <div className="space-y-2">
          <Label htmlFor="funding_mode">{t('fundingModeLabel')}</Label>
          <Select
            name="funding_mode"
            defaultValue={pool?.funding_mode ?? 'donation'}
          >
            <SelectTrigger id="funding_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* All available funding modes translated and mapped */}
              {PUBLIC_POOL_FUNDING_MODES.map((fundingMode) => (
                <SelectItem key={fundingMode} value={fundingMode}>
                  {tFunding(fundingMode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pool status; select field, default to 'open' */}
        <div className="space-y-2">
          <Label htmlFor="status">{t('statusLabel')}</Label>
          <Select
            name="status"
            defaultValue={pool?.status ?? 'open'}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Translated statuses as select options */}
              {PUBLIC_POOL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {tStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Optional documentation path input */}
      <div className="space-y-2">
        <Label htmlFor="doc_path">{t('docPathLabel')}</Label>
        <Input
          id="doc_path"
          name="doc_path"
          placeholder={t('docPathPlaceholder')}
          defaultValue={pool?.doc_path ?? ''}
        />
      </div>

      {/* Optional labels, entered as a comma-separated string */}
      <div className="space-y-2">
        <Label htmlFor="labels">{t('labelsLabel')}</Label>
        <Input
          id="labels"
          name="labels"
          defaultValue={(pool?.labels ?? []).join(', ')}
          placeholder={t('labelsPlaceholder')}
        />
      </div>

      {/* Summary panel: shown only in edit mode when pool exists */}
      {mode === 'edit' && pool ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          {/* Show like count (meta info) */}
          <p>{t('likesCount', { count: pool.like_count })}</p>
          {/* Pool funding pledge summary */}
          <p>
            {t('pledgedSummary', {
              pledged: pool.pledged_ring,
              goal: pool.goal_ring,
              token: nativeToken,
            })}
          </p>
        </div>
      ) : null}

      {/* Display errors if present */}
      {error ? (
        <p className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {/* Submit button; disabled while async transition pending */}
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t('saving')
            : mode === 'create'
              ? t('createPool')
              : t('saveChanges')}
        </Button>
        {/* Cancel button; uses Next <Link> for navigation */}
        <Button type="button" variant="outline" asChild>
          <Link href={toAppHref(ROUTES.ADMIN_DAO(locale))}>
            {t('cancel')}
          </Link>
        </Button>
      </div>
    </form>
  )
}
