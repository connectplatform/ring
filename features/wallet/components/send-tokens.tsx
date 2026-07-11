'use client'

import React, { useState, useEffect, useTransition } from 'react'
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
import {
  listUserWallets,
  getNativeTokenBalanceAction,
  transferNativeTokens,
} from '@/app/_actions/wallet'

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

// Main token sending component — React 19 client island; data via Server Actions (Next 16)
export default function SendTokens({ locale, embedded = false, onTransactionComplete }: SendTokensProps) {
  const t = useTranslations('modules.wallet.send')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const contactParam = searchParams.get('contact')
  const [isPending, startTransition] = useTransition()

  const [isLoading, setIsLoading] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showContactSelector, setShowContactSelector] = useState(false)

  const [recipientLabel, setRecipientLabel] = useState<string | null>(null)
  const [recipientLocked, setRecipientLocked] = useState(false)
  const [contactUserId, setContactUserId] = useState<string | null>(null)
  const [ringContactId, setRingContactId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    recipient: '',
    amount: '',
    notes: '',
  })

  const [userWallets, setUserWallets] = useState<WalletListItem[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(null)

  const [ringBalance, setRingBalance] = useState('0')
  const [balanceLoading, setBalanceLoading] = useState(true)

  const loadWallets = async () => {
    if (!session?.user?.id) return
    try {
      const result = await listUserWallets()
      if (!result.success || !result.wallets) {
        throw new Error(result.error || 'Failed to load wallets')
      }
      const wallets = result.wallets as WalletListItem[]
      setUserWallets(wallets)
      const primary = wallets.find((w) => w.isPrimary) ?? wallets[0] ?? null
      setSelectedWallet(primary)
    } catch (error) {
      console.error('Failed to load wallets:', error)
      toast({
        title: tCommon('error'),
        description: t('loadWalletsError'),
        variant: 'destructive',
      })
    }
  }

  const loadBalance = async () => {
    if (!session?.user?.id) return
    try {
      setBalanceLoading(true)
      const result = await getNativeTokenBalanceAction()
      setRingBalance(result.success ? (result.balance ?? '0') : '0')
    } catch {
      setRingBalance('0')
    } finally {
      setBalanceLoading(false)
    }
  }

  const resolveRecipient = async (
    targetUserId: string,
    displayName?: string,
    savedContactId?: string,
  ) => {
    setIsResolving(true)
    try {
      const res = await fetch('/api/ring/contacts/resolve-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUserId: targetUserId }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'resolve failed')
      }
      const data = (await res.json()) as { address?: string }
      if (!data.address) throw new Error('No wallet address')
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
  }

  useEffect(() => {
    if (!session?.user?.id) return
    startTransition(() => {
      void loadWallets()
      void loadBalance()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on session id only
  }, [session?.user?.id])

  useEffect(() => {
    if (contactParam && session?.user?.id) {
      void resolveRecipient(contactParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactParam, session?.user?.id])

  const handleContactPickerSelect = (selection: ContactPickerSelection) => {
    setShowContactSelector(false)
    if (selection.kind === 'user') {
      const user = selection.user
      void resolveRecipient(user.id, user.name || user.username || user.id)
      return
    }
    const contact = selection.contact
    void resolveRecipient(contact.contactUserId, contact.displayName, contact.id)
  }

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

  const handleSendTokens = async () => {
    if (!session?.user?.id || !selectedWallet) return

    const validationError = validateForm()
    if (validationError) {
      toast({
        title: tCommon('error'),
        description: validationError,
        variant: 'destructive',
      })
      return
    }

    const recipientSnapshot = formData.recipient
    const amountSnapshot = formData.amount

    try {
      setIsLoading(true)
      const fd = new FormData()
      fd.set('toAddress', recipientSnapshot)
      fd.set('amount', amountSnapshot)
      if (contactUserId) fd.set('contactUserId', contactUserId)
      if (ringContactId) fd.set('ringContactId', ringContactId)
      if (formData.notes.trim()) fd.set('notes', formData.notes.trim())

      const data = await transferNativeTokens(fd)

      if (!data.success) {
        throw new Error(data.error || 'Transfer failed')
      }

      toast({
        title: tCommon('success'),
        description: t('sendSuccess', {
          amount: amountSnapshot,
          name: recipientLabel || t('recipientFallback'),
        }),
      })

      setFormData({ recipient: '', amount: '', notes: '' })
      setRecipientLabel(null)
      setRecipientLocked(false)
      setContactUserId(null)
      setRingContactId(null)
      setShowConfirmDialog(false)

      await loadBalance()

      if (onTransactionComplete && data.txHash) {
        onTransactionComplete({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          walletAddress: selectedWallet.address,
          recipient: recipientSnapshot,
          amount: amountSnapshot,
          tokenSymbol: getNativeTokenSymbol(),
          status: 'success',
          kind: 'send',
        })
      }
    } catch (error) {
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

  const availableBalance = parseFloat(ringBalance) || 0
  const sendAmount = parseFloat(formData.amount) || 0
  const hasInsufficientBalance = sendAmount > availableBalance
  const busy = isLoading || isPending

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
                  <Button onClick={handleSendTokens} disabled={busy} className="flex-1">
                    {busy ? (
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
