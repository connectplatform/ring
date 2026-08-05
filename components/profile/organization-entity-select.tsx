'use client'

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Building2, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'
import { Button } from '@/components/ui/button'

type EntityOption = {
  id: string
  name: string
}

type OrganizationEntitySelectProps = {
  value?: string | null
  onSaved?: (organization: string) => void
  className?: string
}

/**
 * Profile Organization — Davinci-droplist over all Entities (auth GET /api/entities).
 * Membership is not required; search matches entity name / id.
 */
export function OrganizationEntitySelect({
  value,
  onSaved,
  className,
}: OrganizationEntitySelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const tProfile = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [entities, setEntities] = useState<EntityOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const scopeLabel = t('scopes.organization')
  const display = value?.trim() || ''

  const loadEntities = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '60', sort: 'name', sortOrder: 'asc' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/entities?${params.toString()}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(tProfile('organizationLoadFailed'))
      const data = (await res.json()) as {
        entities?: Array<{ id?: string; name?: string }>
        items?: Array<{ id?: string; name?: string }>
      }
      const rows = data.entities || data.items || []
      setEntities(
        rows
          .map((e) => ({
            id: String(e.id || ''),
            name: String(e.name || '').trim(),
          }))
          .filter((e) => e.id && e.name),
      )
    } catch (e) {
      setEntities([])
      setError(e instanceof Error ? e.message : tProfile('organizationLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [tProfile])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void loadEntities(search)
    }, 220)
    return () => window.clearTimeout(handle)
  }, [open, search, loadEntities])

  const filtered = useMemo(() => {
    if (!search.trim()) return entities
    const q = search.toLowerCase()
    return entities.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
    )
  }, [entities, search])

  const persist = (organization: string) => {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('organization', organization)
        const { updateProfile } = await import('@/app/_actions/profile')
        const result = await updateProfile({ success: false, message: '' }, formData)
        if (!result.success) {
          setError(result.message || tProfile('organizationSaveFailed'))
          return
        }
        await updateSession()
        onSaved?.(organization)
        setOpen(false)
        setSearch('')
      } catch {
        setError(tProfile('organizationSaveFailed'))
      }
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      <DavinciDroplist
        open={open}
        onOpenChange={setOpen}
        scopeLabel={scopeLabel}
        search={search}
        onSearchChange={setSearch}
        empty={!loading && filtered.length === 0}
        emptyMessage={error || t('noResults')}
        filterPlaceholder={tProfile('organizationSearchPlaceholder')}
        trigger={
          <DavinciDroplistTrigger
            open={open}
            onClick={() => setOpen(true)}
            disabled={pending}
            className={cn('w-full', !display && 'text-muted-foreground')}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {pending || loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {display || tProfile('organizationNotSet')}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </DavinciDroplistTrigger>
        }
        footer={
          display ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => persist('')}
            >
              {t('clearSelection')}
            </Button>
          ) : null
        }
      >
        {loading && filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {t('searching')}
          </p>
        ) : (
          filtered.map((entity) => (
            <DavinciDroplistItem
              key={entity.id}
              selected={display.toLowerCase() === entity.name.toLowerCase()}
              onSelect={() => persist(entity.name)}
            >
              <span className="flex-1 truncate text-left">{entity.name}</span>
            </DavinciDroplistItem>
          ))
        )}
      </DavinciDroplist>
      {error && open ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
