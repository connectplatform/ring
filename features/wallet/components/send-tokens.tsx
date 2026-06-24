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
import type { WalletTransaction } from '@/features/wallet/types'

interface WalletListItem {
  address: string
  isPrimary: boolean
  label?: string
  chain?: string
}

interface SendTokensProps {
  locale: Locale
  embedded?: boolean
  onTransactionComplete?: (transaction: WalletTransaction) => void
}

export default function SendTokens({ locale, embedded = false, onTransactionComplete }: SendTokensProps) {
  const t = useTranslations('modules.wallet.send')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const contactParam = searchParams.get('contact')

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

  const loadWallets = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      const res = await fetch('/api/wallet/list', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load wallets')
      const data = (await res.json()) as { wallets?: WalletListItem[] }
      const wallets = data.wallets ?? []
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
  }, [session?.user?.id, t, tCommon])

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
    },
    [t, tCommon],
  )

  useEffect(() => {
    void loadWallets()
    void loadBalance()
  }, [loadWallets, loadBalance])

  useEffect(() => {
    if (contactParam && session?.user?.id) {
      void resolveRecipient(contactParam)
    }
  }, [contactParam, session?.user?.id, resolveRecipient])

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

    try {
      setIsLoading(true)

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

      toast({
        title: tCommon('success'),
        description: t('sendSuccess', {
          amount: formData.amount,
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
          id: data.txHash,
          timestamp: new Date().toISOString(),
          walletAddress: data.fromAddress ?? selectedWallet.address,
          txHash: data.txHash,
          recipient: formData.recipient,
          amount: formData.amount,
          tokenSymbol: 'RING',
          status: 'success',
          networkId: 137,
          type: 'send',
          notes: formData.notes,
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

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto px-4 py-8'}>
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
          <div className="space-y-2">
            <Label>{t('fromWallet')}</Label>
            <Select
              value={selectedWallet?.address || ''}
              onValueChange={(address) => {
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
                    {wallet.label || t('walletLabel')} — {wallet.address.slice(0, 6)}...
                    {wallet.address.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWallet && (
              <p className="text-sm text-muted-foreground">
                {balanceLoading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t('ringBalance', { balance: ringBalance })}
              </p>
            )}
          </div>

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
            {recipientLocked && recipientLabel && (
              <p className="text-sm text-muted-foreground">{t('sendingTo', { name: recipientLabel })}</p>
            )}
          </div>

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
            <p className="text-xs text-muted-foreground">{t('tokenRingOnly')}</p>
          </div>

          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('insufficientBalanceDetail', { deficit: sendAmount - availableBalance })}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea
              placeholder={t('notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogTrigger asChild>
              <Button
                className="w-full"
                size="lg"
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
                    <span className="font-medium">{formData.amount} RING</span>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{t('confirmWarning')}</AlertDescription>
                </Alert>

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

      <Dialog open={showContactSelector} onOpenChange={setShowContactSelector}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pickContactTitle')}</DialogTitle>
          </DialogHeader>
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
