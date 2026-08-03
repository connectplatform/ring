'use client'

/**
 * @deprecated (2026-07-16) — Orphaned when profile wallet tab was removed.
 *
 * Historical use: embedded on /profile activeTab==='wallet' beside
 * ProfileAccountTokenWidgets (subscription + stub monthly limits).
 *
 * Superseded on /wallet by:
 * - WalletBalanceHero (credit + native wallets, scopes, refresh)
 * - CreditBalanceItemWidget / NativeWalletListItem
 * - wallet-client.tsx + WalletTransactionFeed
 *
 * Do not remount on profile. Reinsert only if a compact embedded wallet
 * summary is needed outside /wallet — prefer composing WalletBalanceHero
 * pieces instead of this legacy layout.
 *
 * Stub monthly limits UI removed — API still returns hardcoded stubs until
 * real spend policy exists; do not display them.
 */

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Wallet,
  Plus,
  ArrowUpDown,
  History,
  Copy,
  Check,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { getClientCreditCurrencyCode } from '@/lib/payments/credit-balance-client'
import { useSession } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

interface WalletSectionProps {
  locale: Locale
  embedded?: boolean
}

/** @deprecated See file header — use /wallet WalletBalanceHero instead. */
export default function WalletSection({ locale, embedded = false }: WalletSectionProps) {
  const t = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)

  const creditCurrency = getClientCreditCurrencyCode()

  const {
    balance: creditBalance,
    subscription,
    isLoading,
    error,
    refresh: refetchBalance
  } = useCreditBalanceContext()

  const handleCopyAddress = async () => {
    if (session?.user?.wallets?.[0]?.address) {
      try {
        await navigator.clipboard.writeText(session.user.wallets[0].address)
        setCopied(true)
        toast({
          title: "Address copied",
          description: "Wallet address copied to clipboard"
        })
        setTimeout(() => setCopied(false), 2000)
      } catch {
        toast({
          title: "Copy failed",
          description: "Failed to copy address",
          variant: "destructive"
        })
      }
    }
  }

  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-6 ${embedded ? '' : 'p-6'}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('wallet') || 'Wallet'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-bold">
                {creditBalance?.amount
                  ? Number(creditBalance.amount).toLocaleString()
                  : '0'}{' '}
                <span className="text-sm font-normal text-muted-foreground">{creditCurrency}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ≈ ${creditBalance?.main_currency_equivalent || '0.00'} USD
              </p>
            </div>
          </div>
          {session?.user?.wallets?.[0]?.address && (
            <div className="flex items-center gap-2 text-sm">
              <code className="rounded bg-muted px-2 py-1">
                {formatAddress(session.user.wallets[0].address)}
              </code>
              <Button variant="ghost" size="sm" onClick={handleCopyAddress}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={subscription?.active ? "default" : "secondary"}>
                  {subscription?.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {subscription?.next_payment && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Next Payment</span>
                  <span className="text-sm">
                    {new Date(subscription.next_payment).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stub monthly limits card removed — wait for real spend policy SSOT. */}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${locale}/wallet/topup`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add RING Tokens
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${locale}/wallet`)}
            >
              <History className="h-4 w-4 mr-2" />
              View Full Wallet
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button onClick={refetchBalance} variant="outline" size="sm">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          {tCommon('refresh') || 'Refresh Balance'}
        </Button>
      </div>
    </div>
  )
}
