'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Users,
  Plus,
  Search,
  Star,
  StarOff,
  Trash2,
  MessageCircle,
  Send,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ContactCard, ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import { ROUTES } from '@/constants/routes'
import type { RingContact } from '@/features/contacts/types'
import type { Locale } from '@/i18n/shared'
import { toast } from '@/hooks/use-toast'

interface RingContactListProps {
  locale: Locale
  embedded?: boolean
}

export default function RingContactList({ locale, embedded = false }: RingContactListProps) {
  const t = useTranslations('modules.contacts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data: session } = useSession()

  const [contacts, setContacts] = useState<RingContact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadContacts = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const res = await fetch('/api/ring/contacts', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      const data = (await res.json()) as { contacts?: RingContact[] }
      setContacts(data.contacts ?? [])
    } catch {
      toast({
        title: tCommon('error'),
        description: t('loadError'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, t, tCommon])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.username?.toLowerCase().includes(q) ?? false) ||
        (c.notes?.toLowerCase().includes(q) ?? false) ||
        (c.walletAddress?.toLowerCase().includes(q) ?? false),
    )
  }, [contacts, searchQuery])

  const handleAddSelection = async (selection: ContactPickerSelection) => {
    if (selection.kind !== 'user') return

    setPendingUserId(selection.user.id)
    try {
      const res = await fetch('/api/ring/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUserId: selection.user.id }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'add failed')
      }
      toast({ title: tCommon('success'), description: t('added') })
      setShowAddDialog(false)
      await loadContacts()
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('addError'),
        variant: 'destructive',
      })
    } finally {
      setPendingUserId(null)
    }
  }

  const handleToggleFavorite = async (contact: RingContact) => {
    try {
      const res = await fetch(`/api/ring/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !contact.isFavorite }),
      })
      if (!res.ok) throw new Error('patch failed')
      toast({ title: tCommon('success'), description: t('favoriteUpdated') })
      await loadContacts()
    } catch {
      toast({ title: tCommon('error'), description: t('loadError'), variant: 'destructive' })
    }
  }

  const handleRemove = async (contactId: string) => {
    try {
      const res = await fetch(`/api/ring/contacts/${contactId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: tCommon('success'), description: t('removed') })
      await loadContacts()
    } catch {
      toast({ title: tCommon('error'), description: t('removeError'), variant: 'destructive' })
    }
  }

  const handleMessage = (contact: RingContact) => {
    const base = ROUTES.MESSAGES(locale)
    router.push(`${base}?user=${encodeURIComponent(contact.contactUserId)}`)
  }

  const handleSend = (contact: RingContact) => {
    const base = ROUTES.WALLET_SEND(locale)
    router.push(`${base}?contact=${encodeURIComponent(contact.contactUserId)}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto px-4 py-8'}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            {t('title')}
          </h2>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('addContact')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('addContactTitle')}</DialogTitle>
            </DialogHeader>
            <ContactPicker
              locale={locale}
              mode="manage"
              showSaved={false}
              pendingUserId={pendingUserId}
              excludeUserIds={[
                session?.user?.id ?? '',
                ...contacts.map((c) => c.contactUserId),
              ].filter(Boolean)}
              onSelect={(selection) => void handleAddSelection(selection)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            startTransition(() => setSearchQuery(e.target.value))
          }}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {contacts.length === 0 ? t('noContacts') : t('noSearchResults')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {contacts.length === 0 ? t('noContactsHint') : undefined}
              </p>
              {contacts.length === 0 && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addContact')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <ContactCard
                  locale={locale}
                  name={contact.displayName}
                  username={contact.username}
                  photoURL={contact.photoURL}
                  address={contact.walletAddress}
                  isFavorite={contact.isFavorite}
                  isVerified={Boolean(contact.isVerified)}
                  subtitle={contact.notes}
                  linkToProfile
                  actions={
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMessage(contact)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        {t('message')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSend(contact)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        {t('send')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={contact.isFavorite ? t('unfavorite') : t('favorite')}
                        onClick={() => void handleToggleFavorite(contact)}
                      >
                        {contact.isFavorite ? (
                          <StarOff className="h-4 w-4" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('remove')}
                        onClick={() => void handleRemove(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground text-center" aria-live="polite">
          …
        </p>
      )}
    </div>
  )
}
