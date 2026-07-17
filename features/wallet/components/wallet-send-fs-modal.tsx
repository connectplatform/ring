'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatNativeBalance } from '@/features/wallet/utils/balance-cache'
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Search,
} from 'lucide-react'

type ModalStep = 'pick' | 'amount' | 'confirm'

interface ResolvedRecipient {
  contactUserId: string
  ringContactId?: string
  address: string
  displayName: string
  username?: string | null
  photoURL?: string | null
  isVerified: boolean
}

export interface WalletSendFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  wallet: WalletInfo
  onSuccess?: () => void
}

export default function WalletSendFsModal({
  open,
  onOpenChange,
  locale,
  wallet,
  onSuccess,
}: WalletSendFsModalProps) {
  const t = useTranslations('modules.wallet.send')
  const tWallet = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const tokenSymbol = wallet.tokenSymbol ?? getClientNativeTokenSymbol()
  const projectName = getClientSiteName()

  const [step, setStep] = useState<ModalStep>('pick')
  const [allContactsExpanded, setAllContactsExpanded] = useState(false)
  const [contacts, setContacts] = useState<RingContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null)
  const [amount, setAmount] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const { results, loading: searchLoading, search, term, clear } = useUserSearch()

  const availableBalance = parseFloat(wallet.nativeBalance || '0') || 0
  const sendAmount = parseFloat(amount) || 0
  const hasInsufficientBalance = sendAmount > availableBalance

  const resetModal = useCallback(() => {
    setStep('pick')
    setAllContactsExpanded(false)
    setRecipient(null)
    setAmount('')
    clear()
    setIsResolving(false)
    setIsSending(false)
  }, [clear])

  useEffect(() => {
    if (!open) {
      resetModal()
      return
    }
    const loadContacts = async () => {
      try {
        setContactsLoading(true)
        const res = await fetch('/api/ring/contacts', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { contacts?: RingContact[] }
        setContacts(data.contacts ?? [])
      } catch {
        setContacts([])
      } finally {
        setContactsLoading(false)
      }
    }
    void loadContacts()
  }, [open, resetModal])

  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(inset)
    }
    updateInset()
    vv.addEventListener('resize', updateInset)
    vv.addEventListener('scroll', updateInset)
    return () => {
      vv.removeEventListener('resize', updateInset)
      vv.removeEventListener('scroll', updateInset)
    }
  }, [open, step])

  const filteredContacts = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return []
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.username?.toLowerCase().includes(q) ?? false),
    )
  }, [contacts, term])

  const searchMatches = useMemo(() => {
    const excluded = new Set(session?.user?.id ? [session.user.id] : [])
    return results.filter((u) => !excluded.has(u.id))
  }, [results, session?.user?.id])

  const resolveRecipient = async (
    contactUserId: string,
    meta: {
      displayName?: string
      username?: string | null
      photoURL?: string | null
      isVerified?: boolean
      ringContactId?: string
    },
  ) => {
    setIsResolving(true)
    try {
      const res = await fetch('/api/ring/contacts/resolve-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUserId }),
      })
      const data = (await res.json()) as {
        address?: string
        displayName?: string
        username?: string | null
        photoURL?: string | null
        isVerified?: boolean
        error?: string
      }
      if (!res.ok || !data.address) {
        throw new Error(data.error || t('resolveWalletError'))
      }
      setRecipient({
        contactUserId,
        ringContactId: meta.ringContactId,
        address: data.address,
        displayName: data.displayName ?? meta.displayName ?? contactUserId,
        username: data.username ?? meta.username,
        photoURL: data.photoURL ?? meta.photoURL,
        isVerified: data.isVerified ?? meta.isVerified ?? false,
      })
      setStep('amount')
      setAllContactsExpanded(false)
      clear()
      setTimeout(() => amountInputRef.current?.focus(), 100)
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('resolveWalletError'),
        variant: 'destructive',
      })
    } finally {
      setIsResolving(false)
    }
  }

  const handleContactPick = (contact: RingContact) => {
    void resolveRecipient(contact.contactUserId, {
      displayName: contact.displayName,
      username: contact.username,
      photoURL: contact.photoURL,
      ringContactId: contact.id,
      isVerified: contact.isVerified,
    })
  }

  const handleUserPick = (user: UserSearchResult) => {
    void resolveRecipient(user.id, {
      displayName: user.name || user.username || user.id,
      username: user.username,
      photoURL: user.photoURL,
      isVerified: user.isVerified,
    })
  }

  const handleConfirmSend = async () => {
    if (!recipient || !amount.trim()) return
    if (hasInsufficientBalance) {
      toast({
        title: tCommon('error'),
        description: t('insufficientBalance'),
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSending(true)
      const res = await fetch('/api/wallet/token/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: recipient.address,
          amount,
          contactUserId: recipient.contactUserId,
          ringContactId: recipient.ringContactId,
          contactDisplayName: recipient.displayName,
          contactUsername: recipient.username ?? undefined,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || t('sendFailed'))

      toast({
        title: tCommon('success'),
        description: t('sendSuccess', {
          amount,
          name: recipient.displayName,
        }),
      })
      onSuccess?.()
      onOpenChange(false)
      resetModal()
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
      : t('sendToContact', { token: tokenSymbol, project: projectName })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 p-0 overflow-hidden',
          allContactsExpanded
            ? 'fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:rounded-none'
            : 'max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:pt-10 sm:max-w-lg',
        )}
        style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
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
                  autoFocus
                  placeholder={t('recipientSearchHint')}
                  value={term}
                  onChange={(e) => search(e.target.value)}
                  className="pl-10"
                />
              </div>

              {(searchLoading || isResolving) && (
                <div className="flex justify-center py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}

              {term.trim().length >= 2 && (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {searchMatches.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => handleUserPick(user)}
                    >
                      <ContactCard
                        locale={locale}
                        name={user.name}
                        username={user.username}
                        photoURL={user.photoURL}
                        isVerified={user.isVerified}
                        linkToProfile={false}
                        compact
                      />
                    </button>
                  ))}
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => handleContactPick(contact)}
                    >
                      <ContactCard
                        locale={locale}
                        name={contact.displayName}
                        username={contact.username}
                        photoURL={contact.photoURL}
                        address={contact.walletAddress}
                        isFavorite={contact.isFavorite}
                        isVerified={Boolean(contact.isVerified)}
                        linkToProfile={false}
                        compact
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Collapsible
              open={allContactsExpanded}
              onOpenChange={setAllContactsExpanded}
              className="flex min-h-0 flex-1 flex-col"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full shrink-0 items-center justify-between border-y px-4 py-3 text-sm font-medium sm:px-6"
                >
                  {t('allContacts')}
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', allContactsExpanded && 'rotate-180')}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6',
                  allContactsExpanded && 'max-h-[calc(100dvh-8rem)]',
                )}
              >
                {contactsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t('noContacts')}</p>
                ) : (
                  <div className="space-y-1 pt-2">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                        onClick={() => handleContactPick(contact)}
                      >
                        <ContactCard
                          locale={locale}
                          name={contact.displayName}
                          username={contact.username}
                          photoURL={contact.photoURL}
                          address={contact.walletAddress}
                          isFavorite={contact.isFavorite}
                          isVerified={Boolean(contact.isVerified)}
                          linkToProfile={false}
                          compact
                        />
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {step === 'amount' && recipient && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <p className="mb-4 text-sm text-muted-foreground">
                {tWallet('showingFor', {
                  wallet: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('ringBalance', {
                  balance: formatNativeBalance(wallet.nativeBalance),
                })}
              </p>
            </div>

            <div className="sticky bottom-0 shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3">
                <div className="row-span-2 self-start">
                  <ContactCard
                    locale={locale}
                    name={recipient.displayName}
                    username={recipient.username}
                    photoURL={recipient.photoURL}
                    isVerified={recipient.isVerified}
                    linkToProfile={false}
                    compact={false}
                    className="pointer-events-none"
                  />
                </div>
                <Label htmlFor="send-amount" className="col-span-1 text-sm">
                  {t('enterAmount')}
                </Label>
                <div className="col-span-1 flex gap-2">
                  <Input
                    id="send-amount"
                    ref={amountInputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    disabled={!amount || hasInsufficientBalance || isResolving}
                    onClick={() => setStep('confirm')}
                  >
                    {t('sendButton', { amount: amount || '0', token: tokenSymbol })}
                  </Button>
                </div>
              </div>
              {hasInsufficientBalance && (
                <p className="mt-2 text-xs text-destructive">{t('insufficientBalance')}</p>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && recipient && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
            <p className="text-sm">
              {t('previewIrreversible', { amount, name: recipient.displayName })}
            </p>
            {!recipient.isVerified && (
              <Alert className="mt-3" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('recipientUnverified', { name: recipient.displayName })}
                </AlertDescription>
              </Alert>
            )}
            <div className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('fromWallet')}</span>
                <span className="font-mono text-xs">
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('toAddress')}</span>
                <span className="font-mono text-xs">
                  {recipient.address.slice(0, 6)}…{recipient.address.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('amount')}</span>
                <span className="font-medium">
                  {amount} {tokenSymbol}
                </span>
              </div>
              {recipient.username && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Username</span>
                  <span>@{recipient.username}</span>
                </div>
              )}
            </div>
            <Button
              type="button"
              className="mt-6 w-full"
              size="lg"
              disabled={isSending}
              onClick={() => void handleConfirmSend()}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('sending')}
                </>
              ) : (
                t('confirmSend')
              )}
            </Button>
            <div className="mt-6" aria-hidden />
            <button
              type="button"
              className="w-full py-2 text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={handleClose}
            >
              {tCommon('actions.cancel')}
            </button>
          </div>
        )}

        {step !== 'confirm' && (
          <div className="shrink-0 border-t px-4 py-3 sm:px-6">
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={handleClose}
            >
              {tCommon('actions.cancel')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
