'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Send,
  AlertTriangle,
  Check,
  Loader2,
  Users,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import type { Locale } from '@/i18n/shared'
import type { WalletTransactionExcerpt } from '@/features/wallet/types'
import { getNativeTokenSymbol, SupportedChains } from '@/lib/ring-config-chain'

// TODO: Consider migrating state like formData and booleans to use React 19's useOptimistic or useFormState for enhancements in future codemods.
// TODO: Replace useEffect + fetch for data-loading (`loadWallets`, `loadBalance`) with React 19's use hook and Next 16 server actions for data and mutative ops where possible, requiring refactor from client to server actions. Currently, all data-fetch is client-side for interactive UX.

interface WalletListItem {
  address: string
  isPrimary: boolean
  label?: string
  chain?: SupportedChains
}

interface SendTokensProps {
  locale: Locale
  embedded?: boolean
  onTransactionComplete?: (transaction: WalletTransactionExcerpt) => void
}

// Main token sending component
export default function SendTokens({ locale, embedded = false, onTransactionComplete }: SendTokensProps) {
  // Translation hooks for wallet and common UI text
  const t = useTranslations('modules.wallet.send')
  const tCommon = useTranslations('common')
  // Session from NextAuth to get the current user
  const { data: session } = useSession()
  // Reading search params for pre-filling e.g. contact via query string
  const searchParams = useSearchParams()
  const contactParam = searchParams.get('contact')

  // UI state hooks for loaders and modals/UX flows
  const [isLoading, setIsLoading] = useState(false) // sending progress
  const [isResolving, setIsResolving] = useState(false) // recipient resolving progress
  const [showConfirmDialog, setShowConfirmDialog] = useState(false) // for "are you sure?" sending dialog
  const [showContactSelector, setShowContactSelector] = useState(false) // open/close contact picker modal

  // State for "resolved" recipient info
  const [recipientLabel, setRecipientLabel] = useState<string | null>(null) // UI display name
  const [recipientLocked, setRecipientLocked] = useState(false) // disables further edits if selected from contacts
  const [contactUserId, setContactUserId] = useState<string | null>(null) // used for backend contact tracking
  const [ringContactId, setRingContactId] = useState<string | null>(null) // used for backend contact tracking

  // Controlled form data for the send operation
  const [formData, setFormData] = useState({
    recipient: '', // address
    amount: '', // amount as string
    notes: '', // optional note
  })

  // All wallets for the user and currently selected wallet for sending
  const [userWallets, setUserWallets] = useState<WalletListItem[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(null)

  // Current Ring token balance and (separate) loading state
  const [ringBalance, setRingBalance] = useState('0')
  const [balanceLoading, setBalanceLoading] = useState(true)

  /**
   * Loads user's wallets from API on mount/session.
   */
  const loadWallets = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const res = await fetch('/api/wallet/list', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load wallets')
      const data = (await res.json()) as { wallets?: WalletListItem[] }
      const wallets = data.wallets ?? []
      setUserWallets(wallets)
      // Automatically select primary or the first as current sender wallet
      const primary = wallets.find((w) => w.isPrimary) ?? wallets[0] ?? null
      setSelectedWallet(primary)
    } catch (error) {
      // Handles API/network errors and notifies via toast
      console.error('Failed to load wallets:', error)
      toast({
        title: tCommon('error'),
        description: t('loadWalletsError'),
        variant: 'destructive',
      })
    }
  }, [session?.user?.id, t, tCommon])

  /**
   * Loads wallet's Ring token balance from API (for selected user wallet).
   */
  const loadBalance = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      setBalanceLoading(true)
      const res = await fetch('/api/wallet/ring/balance', { cache: 'no-store' })
      if (!res.ok) throw new Error('balance failed')
      const data = (await res.json()) as { balance?: string }
      setRingBalance(data.balance ?? '0')
    } catch {
      setRingBalance('0')
    } finally {
      setBalanceLoading(false)
    }
  }, [session?.user?.id])

  /**
   * Resolves a user/contact to an on-chain wallet address for pay-to-user flows and disables editing.
   * Called when a recipient is selected from the contact picker.
   */
  const resolveRecipient = useCallback(
    async (targetUserId: string, displayName?: string, savedContactId?: string) => {
      setIsResolving(true)
      try {
        const res = await fetch('/api/ring/contacts/resolve-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactUserId: targetUserId }),
        })
        if (!res.ok) {
          // Try to extract API error message (handles both JSON and plain error)
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error || 'resolve failed')
        }
        // Receives resolved blockchain address for recipient
        const data = (await res.json()) as { address?: string }
        if (!data.address) throw new Error('No wallet address')
        // Locks the recipient input (user picked from contacts) and stores ids/names for UX & backend
        setContactUserId(targetUserId)
        setRingContactId(savedContactId ?? null)
        setRecipientLabel(displayName ?? null)
        setRecipientLocked(true)
        setFormData((prev) => ({ ...prev, recipient: data.address! }))
      } catch (error) {
        toast({
          title: tCommon('error'),
          description: error instanceof Error ? error.message : t('resolveWalletError'),
          variant: 'destructive',
        })
      } finally {
        setIsResolving(false)
      }
    },
    [t, tCommon],
  )

  // Load wallets and balance on mount/session change
  useEffect(() => {
    void loadWallets()
    void loadBalance()
  }, [loadWallets, loadBalance])

  // If ?contact= param present (contact picker from elsewhere), auto-resolve that contact
  useEffect(() => {
    if (contactParam && session?.user?.id) {
      void resolveRecipient(contactParam)
    }
  }, [contactParam, session?.user?.id, resolveRecipient])

  /**
   * Handles recipient selection from the contact picker modal.
   */
  const handleContactPickerSelect = (selection: ContactPickerSelection) => {
    setShowContactSelector(false)
    // If picked a user, resolve wallet from user info, otherwise use the contact object
    if (selection.kind === 'user') {
      const user = selection.user
      void resolveRecipient(user.id, user.name || user.username || user.id)
      return
    }
    const contact = selection.contact
    void resolveRecipient(contact.contactUserId, contact.displayName, contact.id)
  }

  /**
   * Validates send form prior to initiating transfer.
   * Returns translation string describing the error or null if valid.
   */
  const validateForm = (): string | null => {
    if (!formData.recipient.trim()) {
      return t('recipientRequired')
    }
    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) {
      return t('amountRequired')
    }
    if (parseFloat(formData.amount) > parseFloat(ringBalance)) {
      return t('insufficientBalance')
    }
    if (!selectedWallet) {
      return t('noWalletSelected')
    }
    return null
  }

  /**
   * Main send logic, called after confirmation dialog
   */
  const handleSendTokens = async () => {
    if (!session?.user?.id || !selectedWallet) return

    // Prevent send if form is invalid
    const validationError = validateForm()
    if (validationError) {
      toast({
        title: tCommon('error'),
        description: validationError,
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      // Sends the transfer request to backend; addresses/ids come from the resolved/contact picker
      const res = await fetch('/api/wallet/ring/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: formData.recipient,
          amount: formData.amount,
          contactUserId: contactUserId ?? undefined,
          ringContactId: ringContactId ?? undefined,
          notes: formData.notes.trim() || undefined,
        }),
      })

      const data = (await res.json()) as {
        error?: string
        txHash?: string
        fromAddress?: string
      }

      if (!res.ok) {
        throw new Error(data.error || 'Transfer failed')
      }

      // Show success toast
      toast({
        title: tCommon('success'),
        description: t('sendSuccess', {
          amount: formData.amount,
          name: recipientLabel || t('recipientFallback'),
        }),
      })

      // Clear form and UX states after send
      setFormData({ recipient: '', amount: '', notes: '' })
      setRecipientLabel(null)
      setRecipientLocked(false)
      setContactUserId(null)
      setRingContactId(null)
      setShowConfirmDialog(false)

      // Refresh sender balance
      await loadBalance()

      // Optionally notify parent of transaction, if has callback
      if (onTransactionComplete && data.txHash) {
        onTransactionComplete({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          walletAddress: selectedWallet.address,
          recipient: formData.recipient,
          amount: formData.amount,
          tokenSymbol: getNativeTokenSymbol(),
          status: 'success',
          kind: 'send',
        })
      }
    } catch (error) {
      // Handles any failures from API/backend
      console.error('Failed to send tokens:', error)
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('sendFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Compute numeric balance and amount for validation and warnings
  const availableBalance = parseFloat(ringBalance) || 0
  const sendAmount = parseFloat(formData.amount) || 0
  const hasInsufficientBalance = sendAmount > availableBalance

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto px-4 py-8'}>
      {/* Header for token transfer workflow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Send className="h-8 w-8" />
            {t('title')}
          </h2>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('transferDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From wallet selector */}
          <div className="space-y-2">
            <Label>{t('fromWallet')}</Label>
            <Select
              value={selectedWallet?.address || ''}
              onValueChange={(address) => {
                // Changes sending wallet to selected/account
                const wallet = userWallets.find((w) => w.address === address)
                setSelectedWallet(wallet || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectWallet')} />
              </SelectTrigger>
              <SelectContent>
                {userWallets.map((wallet) => (
                  <SelectItem key={wallet.address} value={wallet.address}>
                    {/* Show label (or fallback), and trimmed address for UX */}
                    {wallet.label || t('walletLabel')} — {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWallet && (
              <p className="text-sm text-muted-foreground">
                {/* Loading indicator for balance */}
                {balanceLoading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t('ringBalance', { balance: ringBalance })}
              </p>
            )}
          </div>
          {/* Recipient address input/picker */}
          <div className="space-y-2">
            <Label>{t('toAddress')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('recipientPlaceholder')}
                value={formData.recipient}
                readOnly={recipientLocked}
                onChange={(e) => {
                  if (!recipientLocked) {
                    setFormData((prev) => ({ ...prev, recipient: e.target.value }))
                  }
                }}
                className="flex-1 font-mono text-sm"
              />
              {/* Opens contact picker to select recipient */}
              <Button
                variant="outline"
                onClick={() => setShowContactSelector(true)}
                title={t('pickContact')}
                disabled={isResolving}
              >
                {isResolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Shows recipient label if resolved from contact */}
            {recipientLocked && recipientLabel && (
              <p className="text-sm text-muted-foreground">{t('sendingTo', { name: recipientLabel })}</p>
            )}
          </div>
          {/* Amount entry */}
          <div className="space-y-2">
            <Label>{t('amount')}</Label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t('tokenNativeTokenOnly')}</p>
          </div>
          {/* Insufficient balance alert */}
          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('insufficientBalanceDetail', { deficit: sendAmount - availableBalance })}</AlertDescription>
            </Alert>
          )}
          {/* Optional notes for this transfer */}
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea
              placeholder={t('notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
          {/* Confirmation Dialog: Appears before actually sending */}
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogTrigger asChild>
              <Button
                className="w-full"
                size="lg"
                // Only enable if required fields complete and not loading nor insufficient
                disabled={!formData.recipient || !formData.amount || hasInsufficientBalance || isResolving}
              >
                <Send className="h-4 w-4 mr-2" />
                {t('sendButton', { amount: formData.amount || '0' })}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('confirmTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Summary of TX for user */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t('fromWallet')}</span>
                    <span className="font-mono">
                      {selectedWallet?.address.slice(0, 6)}...{selectedWallet?.address.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t('toAddress')}</span>
                    <span>{recipientLabel || `${formData.recipient.slice(0, 6)}...${formData.recipient.slice(-4)}`}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t('amount')}</span>
                    <span className="font-medium">{formData.amount} {getNativeTokenSymbol()}</span>
                  </div>
                </div>
                {/* Final warning before submit */}
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{t('confirmWarning')}</AlertDescription>
                </Alert>
                {/* Confirm and cancel buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1">
                    {tCommon('actions.cancel')}
                  </Button>
                  <Button onClick={handleSendTokens} disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('sending')}
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t('confirmSend')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      {/* Contact picker modal for selecting existing users */}
      <Dialog open={showContactSelector} onOpenChange={setShowContactSelector}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pickContactTitle')}</DialogTitle>
          </DialogHeader>
          {/* Shows list of contacts. Excludes self, passes selection handler. */}
          <ContactPicker
            locale={locale}
            mode="send"
            onSelect={handleContactPickerSelect}
            excludeUserIds={session?.user?.id ? [session.user.id] : []}
            showSaved
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
