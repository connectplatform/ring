'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUserSearch } from '@/hooks/use-user-search'
import type { UserSearchResult } from '@/features/auth/services/search-users'
import type { RingContact } from '@/features/contacts/types'
import type { Locale } from '@/i18n/shared'
import ContactCard from './contact-card'

export type ContactPickerMode = 'message' | 'send' | 'manage'

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
}

export default function ContactPicker({
  locale,
  mode,
  onSelect,
  excludeUserIds = [],
  showSaved = true,
  pendingUserId = null,
  className,
}: ContactPickerProps) {
  const tMessenger = useTranslations('modules.messenger')
  const tContacts = useTranslations('modules.contacts')
  const { results, loading, error, search, clear, term } = useUserSearch()
  const [savedContacts, setSavedContacts] = useState<RingContact[]>([])
  const [savedLoading, setSavedLoading] = useState(false)

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

  const filteredSaved = savedContacts.filter((c) => !excluded.has(c.contactUserId))
  const filteredResults = results.filter((u) => !excluded.has(u.id))

  const handleUserSelect = (user: UserSearchResult) => {
    onSelect({ kind: 'user', user })
  }

  const handleContactSelect = (contact: RingContact) => {
    onSelect({ kind: 'contact', contact })
  }

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus={mode !== 'manage'}
          placeholder={tMessenger('searchUsersPlaceholder')}
          value={term}
          onChange={(e) => search(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}

      {showSaved && filteredSaved.length > 0 && term.trim().length < 2 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            {tContacts('savedContacts')}
          </p>
          {savedLoading ? (
            <div className="flex justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            filteredSaved.map((contact) => (
              <Button
                key={contact.id}
                type="button"
                variant="ghost"
                className="w-full justify-start h-auto py-2 px-2"
                onClick={() => handleContactSelect(contact)}
              >
                <ContactCard
                  locale={locale}
                  name={contact.displayName}
                  username={contact.username}
                  photoURL={contact.photoURL}
                  address={contact.walletAddress}
                  isFavorite={contact.isFavorite}
                  linkToProfile={false}
                  compact
                />
              </Button>
            ))
          )}
        </div>
      )}

      <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {tMessenger('searchingUsers')}
          </div>
        )}
        {!loading && term.trim().length >= 2 && filteredResults.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {tMessenger('noUsersFound')}
          </p>
        )}
        {filteredResults.map((user) => {
          const isPending = pendingUserId === user.id
          return (
            <Button
              key={user.id}
              type="button"
              variant="ghost"
              className="w-full justify-start h-auto py-2 px-2"
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
                actions={
                  isPending ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : undefined
                }
              />
            </Button>
          )
        })}
      </div>

      {mode === 'manage' && term.trim().length < 2 && !showSaved && (
        <p className="text-sm text-muted-foreground text-center py-4">
          {tContacts('searchToAdd')}
        </p>
      )}
    </div>
  )
}
