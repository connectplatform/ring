'use client'

/**
 * Payment-request FS modal — pick contact (reuse send modal patterns),
 * enter amount + note, post payment_request message to direct chat.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import ContactCard from '@/components/contacts/contact-card'
import { useUserSearch } from '@/hooks/use-user-search'
import type { UserSearchResult } from '@/features/auth/services/search-users'
import type { RingContact } from '@/features/contacts/types'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import type { Locale } from '@/i18n/shared'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getClientNativeTokenSymbol, getClientSiteName } from '@/lib/ring-config-client'
import { sendNativeTokenPaymentRequest } from '@/app/_actions/wallet'
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Receipt,
  Search,
} from 'lucide-react'

type ModalStep = 'pick' | 'amount' | 'confirm'

interface ResolvedRecipient {
  contactUserId: string
  displayName: string
  username?: string | null
  photoURL?: string | null
  isVerified: boolean
}

export interface WalletRequestFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  wallet: WalletInfo
  /** When set, skip contact pick and start at amount step */
  initialRecipient?: {
    contactUserId: string
    displayName: string
    username?: string | null
    photoURL?: string | null
    isVerified?: boolean
  }
  onSuccess?: () => void
}

export default function WalletRequestFsModal({
  open,
  onOpenChange,
  locale,
  wallet,
  initialRecipient,
  onSuccess,
}: WalletRequestFsModalProps) {
  const t = useTranslations('modules.wallet.paymentRequest')
  const tSend = useTranslations('modules.wallet.send')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const router = useRouter()
  const tokenSymbol = wallet.tokenSymbol ?? getClientNativeTokenSymbol()
  const projectName = getClientSiteName()

  const [step, setStep] = useState<ModalStep>(initialRecipient ? 'amount' : 'pick')
  const [allContactsExpanded, setAllContactsExpanded] = useState(false)
  const [contacts, setContacts] = useState<RingContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(
    initialRecipient
      ? {
          contactUserId: initialRecipient.contactUserId,
          displayName: initialRecipient.displayName,
          username: initialRecipient.username,
          photoURL: initialRecipient.photoURL,
          isVerified: Boolean(initialRecipient.isVerified),
        }
      : null,
  )
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { results, loading: searchLoading, search, term, clear } = useUserSearch()

  const sendAmount = parseFloat(amount) || 0
  const amountInvalid = !amount.trim() || sendAmount <= 0

  const resetModal = useCallback(() => {
    if (initialRecipient) {
      setStep('amount')
      setRecipient({
        contactUserId: initialRecipient.contactUserId,
        displayName: initialRecipient.displayName,
        username: initialRecipient.username,
        photoURL: initialRecipient.photoURL,
        isVerified: Boolean(initialRecipient.isVerified),
      })
    } else {
      setStep('pick')
      setRecipient(null)
    }
    setAllContactsExpanded(false)
    setAmount('')
    setNote('')
    clear()
    setIsSending(false)
  }, [clear, initialRecipient])

  useEffect(() => {
    if (!open) {
      resetModal()
      return
    }
    // TODO(public-invoice): QR / shareable invoice without a contact — deferred.
    if (initialRecipient) {
      setStep('amount')
      setRecipient({
        contactUserId: initialRecipient.contactUserId,
        displayName: initialRecipient.displayName,
        username: initialRecipient.username,
        photoURL: initialRecipient.photoURL,
        isVerified: Boolean(initialRecipient.isVerified),
      })
    }
    let cancelled = false
    setContactsLoading(true)
    void fetch('/api/ring/contacts', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { contacts: [] }))
      .then((data: { contacts?: RingContact[] }) => {
        if (!cancelled) setContacts(data.contacts ?? [])
      })
      .catch(() => {
        if (!cancelled) setContacts([])
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, resetModal, initialRecipient])

  const filteredContacts = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.username?.toLowerCase().includes(q) ?? false),
    )
  }, [contacts, term])

  const selectRecipient = (next: ResolvedRecipient) => {
    setRecipient(next)
    setStep('amount')
    setAllContactsExpanded(false)
  }

  const handleSelectContact = (contact: RingContact) => {
    selectRecipient({
      contactUserId: contact.contactUserId,
      displayName: contact.displayName,
      username: contact.username,
      photoURL: contact.photoURL,
      isVerified: Boolean(contact.isVerified),
    })
  }

  const handleSelectUser = (user: UserSearchResult) => {
    selectRecipient({
      contactUserId: user.id,
      displayName: user.name || user.username || user.id,
      username: user.username,
      photoURL: user.photoURL,
      isVerified: Boolean(user.isVerified),
    })
  }

  const handleConfirm = async () => {
    if (!recipient || amountInvalid) return
    try {
      setIsSending(true)
      const result = await sendNativeTokenPaymentRequest({
        toUserId: recipient.contactUserId,
        amount: amount.trim(),
        note: note.trim() || undefined,
        displayName: recipient.displayName,
      })
      if (!result.success) {
        throw new Error(result.error || t('sendFailed'))
      }
      toast({
        title: tCommon('success'),
        description: t('sendSuccess', {
          amount: amount.trim(),
          token: tokenSymbol,
          name: recipient.displayName,
        }),
      })
      onSuccess?.()
      onOpenChange(false)
      resetModal()
      if (result.conversationId) {
        router.push(`/${locale}/messages?conversation=${result.conversationId}`)
      }
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('sendFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    resetModal()
  }

  const headerTitle =
    step === 'confirm'
      ? t('confirmTitle')
      : t('titleFlow', { token: tokenSymbol, project: projectName })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 p-0 overflow-hidden',
          allContactsExpanded
            ? 'fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:rounded-none'
            : 'max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:pt-10 sm:max-w-lg',
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle className="text-left text-base sm:text-lg">{headerTitle}</DialogTitle>
        </DialogHeader>

        {step === 'pick' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 space-y-3 px-4 py-3 sm:px-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={tSend('recipientSearchHint')}
                  value={term}
                  onChange={(e) => search(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-2">
              {(searchLoading || contactsLoading) && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full rounded-lg border border-border/50 p-2 text-left hover:bg-muted/40"
                  onClick={() => handleSelectUser(user)}
                >
                  <ContactCard
                    locale={locale}
                    compact
                    name={user.name}
                    username={user.username}
                    photoURL={user.photoURL}
                    isVerified={user.isVerified}
                    linkToProfile={false}
                  />
                </button>
              ))}
              <Collapsible open={allContactsExpanded} onOpenChange={setAllContactsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    {tSend('allContacts')}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {filteredContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {tSend('noContacts')}
                    </p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full rounded-lg border border-border/50 p-2 text-left hover:bg-muted/40"
                        onClick={() => handleSelectContact(contact)}
                      >
                        <ContactCard
                          locale={locale}
                          compact
                          name={contact.displayName}
                          username={contact.username}
                          photoURL={contact.photoURL}
                          isVerified={Boolean(contact.isVerified)}
                          linkToProfile={false}
                        />
                      </button>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        )}

        {step === 'amount' && recipient && (
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <ContactCard
              locale={locale}
              compact
              name={recipient.displayName}
              username={recipient.username}
              photoURL={recipient.photoURL}
              isVerified={recipient.isVerified}
              linkToProfile={false}
            />
            <div className="space-y-2">
              <Label>{tSend('amount')}</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('noteLabel')}</Label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('pick')}>
                {tCommon('actions.back')}
              </Button>
              <Button
                className="flex-1"
                disabled={amountInvalid}
                onClick={() => setStep('confirm')}
              >
                {tCommon('actions.continue')}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && recipient && (
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('confirmHint', {
                  amount,
                  token: tokenSymbol,
                  name: recipient.displayName,
                })}
              </AlertDescription>
            </Alert>
            {!recipient.isVerified && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {tSend('recipientUnverified', { name: recipient.displayName })}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('amount')}>
                {tCommon('actions.back')}
              </Button>
              <Button className="flex-1" disabled={isSending} onClick={() => void handleConfirm()}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                {t('confirmSend')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
