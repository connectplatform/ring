'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUserSearch } from '@/hooks/use-user-search'
import type { UserSearchResult } from '@/features/auth/services/search-users'
import type { RingContact } from '@/features/contacts/types'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import ContactCard from './contact-card'

export type ContactPickerMode = 'message' | 'send' | 'manage'
export type ContactPickerSelectionMode = 'single' | 'multiple'

export type ContactPickerSelection =
  | { kind: 'user'; user: UserSearchResult }
  | { kind: 'contact'; contact: RingContact }

export interface ContactPickerProps {
  locale: Locale
  mode: ContactPickerMode
  onSelect: (selection: ContactPickerSelection) => void
  excludeUserIds?: string[]
  showSaved?: boolean
  /** When adding from manage flow, show loading on this user id */
  pendingUserId?: string | null
  className?: string
  /** single (default) or multiple selection with chips + confirm */
  selectionMode?: ContactPickerSelectionMode
  /** Optional recency map: userId → lastActivity ms (higher = more recent) */
  recencyByUserId?: Record<string, number>
  /** Multi-select confirm handler */
  onConfirmMultiple?: (selections: ContactPickerSelection[]) => void
  confirmLabel?: string
  /** Controlled selected user ids for multi mode */
  selectedUserIds?: string[]
  onSelectedUserIdsChange?: (ids: string[]) => void
  /** Contact row layout (inline = one-line avatar + name + @username) */
  itemLayout?: 'stacked' | 'inline'
  /** Hide wallet address on cards */
  hideWalletAddress?: boolean
  /** Hide multi-select badge chips (parent may render its own summary row) */
  hideSelectionChips?: boolean
  /** Allow confirm with zero selections (e.g. revoke all trustees) */
  allowEmptyConfirm?: boolean
  /** Extra classes for each selectable contact row button */
  itemClassName?: string
}

function selectionUserId(selection: ContactPickerSelection): string {
  return selection.kind === 'user' ? selection.user.id : selection.contact.contactUserId
}

export default function ContactPicker({
  locale,
  mode,
  onSelect,
  excludeUserIds = [],
  showSaved = true,
  pendingUserId = null,
  className,
  selectionMode = 'single',
  recencyByUserId = {},
  onConfirmMultiple,
  confirmLabel,
  selectedUserIds: controlledSelected,
  onSelectedUserIdsChange,
  itemLayout = 'stacked',
  hideWalletAddress = false,
  hideSelectionChips = false,
  allowEmptyConfirm = false,
  itemClassName,
}: ContactPickerProps) {
  const tMessenger = useTranslations('modules.messenger')
  const tContacts = useTranslations('modules.contacts')
  const { results, loading, error, search, term } = useUserSearch()
  const [savedContacts, setSavedContacts] = useState<RingContact[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [internalSelected, setInternalSelected] = useState<string[]>([])
  const [selectionMap, setSelectionMap] = useState<Record<string, ContactPickerSelection>>({})

  const selectedIds = controlledSelected ?? internalSelected
  const setSelectedIds = onSelectedUserIdsChange ?? setInternalSelected
  const isMulti = selectionMode === 'multiple'
  const excluded = new Set(excludeUserIds)

  const loadSaved = useCallback(async () => {
    if (!showSaved) return
    try {
      setSavedLoading(true)
      const res = await fetch('/api/ring/contacts', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { contacts?: RingContact[] }
      setSavedContacts(data.contacts ?? [])
    } catch {
      setSavedContacts([])
    } finally {
      setSavedLoading(false)
    }
  }, [showSaved])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved])

  const sortByRecency = useCallback(
    <T,>(items: T[], getId: (item: T) => string, getName: (item: T) => string) => {
      return [...items].sort((a, b) => {
        const ra = recencyByUserId[getId(a)] ?? 0
        const rb = recencyByUserId[getId(b)] ?? 0
        if (rb !== ra) return rb - ra
        return getName(a).localeCompare(getName(b))
      })
    },
    [recencyByUserId],
  )

  const filteredSaved = useMemo(
    () =>
      sortByRecency(
        savedContacts.filter((c) => !excluded.has(c.contactUserId)),
        (c) => c.contactUserId,
        (c) => c.displayName || c.username || c.contactUserId,
      ),
    [savedContacts, excluded, sortByRecency],
  )

  const filteredResults = useMemo(
    () =>
      sortByRecency(
        results.filter((u) => !excluded.has(u.id)),
        (u) => u.id,
        (u) => u.name || u.username || u.id,
      ),
    [results, excluded, sortByRecency],
  )

  const savedUserIds = useMemo(
    () => new Set(savedContacts.map((c) => c.contactUserId)),
    [savedContacts],
  )

  const contactSearchHits = useMemo(
    () => filteredResults.filter((u) => savedUserIds.has(u.id)),
    [filteredResults, savedUserIds],
  )

  const nonContactSearchHits = useMemo(
    () => filteredResults.filter((u) => !savedUserIds.has(u.id)),
    [filteredResults, savedUserIds],
  )

  const toggleMulti = (selection: ContactPickerSelection) => {
    const id = selectionUserId(selection)
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    setSelectedIds(next)
    setSelectionMap((prev) => {
      if (selectedIds.includes(id)) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: selection }
    })
  }

  const handleUserSelect = (user: UserSearchResult) => {
    const selection: ContactPickerSelection = { kind: 'user', user }
    if (isMulti) {
      toggleMulti(selection)
      return
    }
    onSelect(selection)
  }

  const handleContactSelect = (contact: RingContact) => {
    const selection: ContactPickerSelection = { kind: 'contact', contact }
    if (isMulti) {
      toggleMulti(selection)
      return
    }
    onSelect(selection)
  }

  const confirmMultiple = () => {
    const selections = selectedIds
      .map((id) => selectionMap[id])
      .filter(Boolean) as ContactPickerSelection[]
    onConfirmMultiple?.(selections)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={mode !== 'manage'}
          placeholder={tMessenger('searchUsersPlaceholder')}
          value={term}
          onChange={(e) => search(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {isMulti && !hideSelectionChips && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const sel = selectionMap[id]
            const label =
              sel?.kind === 'user'
                ? sel.user.name || sel.user.username || id
                : sel?.kind === 'contact'
                  ? sel.contact.displayName
                  : id
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {label}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  onClick={() => toggleMulti(sel || { kind: 'user', user: { id } as UserSearchResult })}
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {showSaved && filteredSaved.length > 0 && term.trim().length < 2 && (
        <div className="space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tContacts('savedContacts')}
          </p>
          {savedLoading ? (
            <div className="flex justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            filteredSaved.map((contact) => {
              const selected = selectedIds.includes(contact.contactUserId)
              return (
                <Button
                  key={contact.id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-auto w-full justify-start rounded-lg px-1.5 py-1',
                    selected && 'bg-accent',
                    itemClassName,
                  )}
                  onClick={() => handleContactSelect(contact)}
                >
                  <ContactCard
                    locale={locale}
                    name={contact.displayName}
                    username={contact.username}
                    photoURL={contact.photoURL}
                    address={hideWalletAddress || itemLayout === 'inline' ? null : contact.walletAddress}
                    isFavorite={contact.isFavorite}
                    isVerified={Boolean(contact.isVerified)}
                    linkToProfile={false}
                    compact
                    layout={itemLayout}
                    hideAddress={hideWalletAddress || itemLayout === 'inline'}
                    actions={
                      isMulti && selected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : undefined
                    }
                  />
                </Button>
              )
            })
          )}
        </div>
      )}

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tMessenger('searchingUsers')}
          </div>
        )}
        {!loading && term.trim().length >= 2 && filteredResults.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tMessenger('noUsersFound')}
          </p>
        )}
        {term.trim().length >= 2 && contactSearchHits.length > 0 && (
          <p className="px-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tContacts('savedContacts')}
          </p>
        )}
        {contactSearchHits.map((user) => {
          const isPending = pendingUserId === user.id
          const selected = selectedIds.includes(user.id)
          return (
            <Button
              key={`contact-hit-${user.id}`}
              type="button"
              variant="ghost"
              className={cn(
                'h-auto w-full justify-start rounded-lg px-1.5 py-1',
                selected && 'bg-accent',
                itemClassName,
              )}
              disabled={isPending}
              onClick={() => handleUserSelect(user)}
            >
              <ContactCard
                locale={locale}
                name={user.name}
                username={user.username}
                photoURL={user.photoURL}
                isVerified={user.isVerified}
                linkToProfile={false}
                compact
                layout={itemLayout}
                hideAddress
                actions={
                  isPending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : isMulti && selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : undefined
                }
              />
            </Button>
          )
        })}
        {term.trim().length >= 2 && nonContactSearchHits.length > 0 && (
          <p className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tContacts('notYourContacts')}
          </p>
        )}
        {nonContactSearchHits.map((user) => {
          const isPending = pendingUserId === user.id
          const selected = selectedIds.includes(user.id)
          return (
            <Button
              key={user.id}
              type="button"
              variant="ghost"
              className={cn(
                'h-auto w-full justify-start rounded-lg px-1.5 py-1',
                selected && 'bg-accent',
                itemClassName,
              )}
              disabled={isPending}
              onClick={() => handleUserSelect(user)}
            >
              <ContactCard
                locale={locale}
                name={user.name}
                username={user.username}
                photoURL={user.photoURL}
                isVerified={user.isVerified}
                linkToProfile={false}
                compact
                layout={itemLayout}
                hideAddress
                actions={
                  isPending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : isMulti && selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : undefined
                }
              />
            </Button>
          )
        })}
      </div>

      {isMulti && onConfirmMultiple && (
        <Button
          type="button"
          className="w-full"
          disabled={!allowEmptyConfirm && selectedIds.length === 0}
          onClick={confirmMultiple}
        >
          {confirmLabel || tMessenger('createGroup')}
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
        </Button>
      )}

      {mode === 'manage' && term.trim().length < 2 && !showSaved && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tContacts('searchToAdd')}
        </p>
      )}
    </div>
  )
}
