'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { Plus, X, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FsModal } from '@/components/ui/fs-modal'
import { QuickSearchFilter } from '@/components/common/quick-search-filter'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DAVINCI_DROPLIST_SCROLLBAR,
  DavinciDroplistItem,
} from '@/components/ui/davinci-droplist'
import {
  PROFILE_TAG_MIN_CHARS,
  filterProfileTags,
  parseProfileTags,
  serializeProfileTags,
} from '@/features/auth/lib/profile-tags'

export type ProfileTagField = 'position' | 'skills'

type ProfileTagCloudProps = {
  field: ProfileTagField
  value?: string | string[] | null
  knownTags: readonly string[]
  onSaved?: (next: string | string[]) => void
  className?: string
  icon?: LucideIcon
  notSetKey: string
  addKey: string
  selectTitleKey: string
  searchPlaceholderKey: string
  searchIdleKey: string
  removeKey: string
  saveFailedKey: string
}

function TagChip({
  tag,
  disabled,
  removeLabel,
  onRemove,
}: {
  tag: string
  disabled?: boolean
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] px-3 py-1 text-sm">
      <span className="truncate">{tag}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={removeLabel}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
        onClick={onRemove}
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </span>
  )
}

/**
 * Profile ring-tag-cloud — inline chips + FsModal search (3+ chars).
 * Selected tags render both outside and inside the modal.
 */
export function ProfileTagCloud({
  field,
  value,
  knownTags,
  onSaved,
  className,
  icon: Icon,
  notSetKey,
  addKey,
  selectTitleKey,
  searchPlaceholderKey,
  searchIdleKey,
  removeKey,
  saveFailedKey,
}: ProfileTagCloudProps) {
  const t = useTranslations('modules.profile')
  const tDroplist = useTranslations('common.davinciDroplist')
  const { update: updateSession } = useSession()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState<string[]>(() => parseProfileTags(value))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  React.useEffect(() => {
    setTags(parseProfileTags(value))
  }, [value])

  const catalog = useMemo(() => {
    const merged = new Map<string, string>()
    for (const tag of knownTags) merged.set(tag.toLowerCase(), tag)
    for (const tag of tags) merged.set(tag.toLowerCase(), tag)
    return Array.from(merged.values()).sort((a, b) => a.localeCompare(b))
  }, [knownTags, tags])

  const suggestions = useMemo(
    () => filterProfileTags(search, catalog, tags),
    [search, catalog, tags],
  )

  const persist = (next: string[]) => {
    setTags(next)
    startTransition(async () => {
      setError(null)
      try {
        const formData = new FormData()
        if (field === 'skills') {
          formData.append('skills', JSON.stringify(next))
        } else {
          formData.append('position', serializeProfileTags(next))
        }
        const { updateProfile } = await import('@/app/_actions/profile')
        const result = await updateProfile({ success: false, message: '' }, formData)
        if (!result.success) {
          setError(result.message || t(saveFailedKey))
          setTags(parseProfileTags(value))
          return
        }
        await updateSession()
        onSaved?.(field === 'skills' ? next : serializeProfileTags(next))
      } catch {
        setError(t(saveFailedKey))
        setTags(parseProfileTags(value))
      }
    })
  }

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (tags.some((t0) => t0.toLowerCase() === trimmed.toLowerCase())) return
    persist([...tags, trimmed])
    setSearch('')
  }

  const removeTag = (tag: string) => {
    persist(tags.filter((t0) => t0.toLowerCase() !== tag.toLowerCase()))
  }

  const searchTooShort =
    search.trim().length > 0 && search.trim().length < PROFILE_TAG_MIN_CHARS

  const chips = (
    tags.length === 0 ? (
      <span className="text-sm text-muted-foreground">{t(notSetKey)}</span>
    ) : (
      tags.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          disabled={pending}
          removeLabel={t(removeKey, { tag })}
          onRemove={() => removeTag(tag)}
        />
      ))
    )
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {chips}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full"
          disabled={pending}
          onClick={() => {
            setSearch('')
            setError(null)
            setOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          {t(addKey)}
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <FsModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
        title={t(selectTitleKey)}
        hideHeaderSeparator
        className="sm:h-[100dvh] sm:max-h-[100dvh]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      >
        <div className="shrink-0 space-y-3 px-4 pb-2 pt-1 sm:px-6">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
              {tags.map((tag) => (
                <TagChip
                  key={`modal-${tag}`}
                  tag={tag}
                  disabled={pending}
                  removeLabel={t(removeKey, { tag })}
                  onRemove={() => removeTag(tag)}
                />
              ))}
            </div>
          ) : null}
          <QuickSearchFilter
            value={search}
            onChange={setSearch}
            placeholder={t(searchPlaceholderKey)}
            autoFocus
            focusKey={open}
            aria-label={t(searchPlaceholderKey)}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {tDroplist('searchHintMinChars', { count: PROFILE_TAG_MIN_CHARS })}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full" scrollbarClassName={DAVINCI_DROPLIST_SCROLLBAR}>
            <div className="px-2 pb-4 sm:px-3">
              {searchTooShort ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {tDroplist('searchHintMinChars', { count: PROFILE_TAG_MIN_CHARS })}
                </p>
              ) : search.trim().length < PROFILE_TAG_MIN_CHARS ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {t(searchIdleKey)}
                </p>
              ) : suggestions.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {tDroplist('noResults')}
                </p>
              ) : (
                suggestions.map((tag) => (
                  <DavinciDroplistItem
                    key={tag}
                    selected={false}
                    onSelect={() => addTag(tag)}
                  >
                    <span className="flex-1 truncate text-left">{tag}</span>
                  </DavinciDroplistItem>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </FsModal>
    </div>
  )
}
