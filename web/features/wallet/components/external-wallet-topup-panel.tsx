'use client'

/**
 * External wallet (Wagmi) top-up panel — allowlisted ERC-20 balances as radios,
 * amount + oracle preview of custodial native RING out.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { erc20Abi, formatUnits } from 'viem'
import { AlertTriangle, Info, Loader2, Wallet } from 'lucide-react'
import {
  useConnection,
  useReadContract,
} from '@/lib/wagmi-config'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  getClientCreditUnitLabel,
  getClientEvmTreasuryAddress,
  getClientNativeTokenSymbol,
  getClientTreasurySwapAllowlist,
  previewNativeTokenFromCreditPoints,
} from '@/lib/ring-config-client'
import { getNativeTokenPerMainCurrencyRate } from '@/app/_actions/wallet'

function AllowlistBalanceProbe({
  tokenAddress,
  owner,
  decimals,
  onBalance,
}: {
  tokenAddress: `0x${string}`
  owner: `0x${string}`
  decimals: number
  onBalance: (token: string, balance: string) => void
}) {
  const { data } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
    query: { enabled: Boolean(owner && tokenAddress) },
  })
  useEffect(() => {
    if (data == null) {
      onBalance(tokenAddress, '0')
      return
    }
    onBalance(tokenAddress, formatUnits(data as bigint, decimals))
  }, [data, decimals, onBalance, tokenAddress])
  return null
}

export default function ExternalWalletTopupPanel({
  onOpenSwap,
}: {
  /** Optional: open full swap modal on wallet page */
  onOpenSwap?: () => void
}) {
  const t = useTranslations('modules.wallet')
  const nativeSymbol = getClientNativeTokenSymbol()
  const creditBalanceUnit = getClientCreditUnitLabel()
  const treasuryAddress = getClientEvmTreasuryAddress()
  const allowlist = useMemo(() => getClientTreasurySwapAllowlist(), [])
  const { address, isConnected } = useConnection()
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<`0x${string}` | null>(null)
  const [amount, setAmount] = useState('')
  const [oracleRate, setOracleRate] = useState<string | null>(null)
  const [quoteOut, setQuoteOut] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)

  const onBalance = useCallback((token: string, balance: string) => {
    setBalances((prev) => (prev[token] === balance ? prev : { ...prev, [token]: balance }))
  }, [])

  useEffect(() => {
    void getNativeTokenPerMainCurrencyRate().then((r) => {
      if (r.success && r.nativePerMainCurrency) {
        setOracleRate(r.nativePerMainCurrency)
      }
    })
  }, [])

  useEffect(() => {
    if (!selected && allowlist[0]?.tokenAddress) {
      setSelected(allowlist[0].tokenAddress)
    }
  }, [allowlist, selected])

  const selectedEntry = allowlist.find((e) => e.tokenAddress === selected)
  const selectedBalance = selected ? balances[selected] ?? '0' : '0'

  useEffect(() => {
    if (!address || !selected || !amount || Number.parseFloat(amount) <= 0) {
      setQuoteOut(null)
      return
    }
    const tmr = setTimeout(() => {
      void (async () => {
        setQuoting(true)
        setQuoteError(null)
        try {
          const res = await fetch('/api/wallet/treasury-swap/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromTokenAddress: selected,
              amountIn: amount,
              signInAddress: address,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Quote failed')
          setQuoteOut(data.amountOut)
        } catch (e) {
          setQuoteError(e instanceof Error ? e.message : 'Quote failed')
          // Fallback preview treating amount as USD-ish for stables × desk rate
          if (oracleRate) {
            setQuoteOut(previewNativeTokenFromCreditPoints(Number.parseFloat(amount), Number(oracleRate)))
          } else {
            setQuoteOut(null)
          }
        } finally {
          setQuoting(false)
        }
      })()
    }, 400)
    return () => clearTimeout(tmr)
  }, [address, selected, amount, oracleRate])

  if (!isConnected || !address) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>
          {t('signinWalletDisconnected', {
            defaultValue: 'Connect a wallet to fund with sign-in assets',
          })}
        </AlertDescription>
      </Alert>
    )
  }

  if (allowlist.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('topup.externalNoAllowlist', {
            defaultValue: 'No allowlisted tokens configured for treasury swap yet.',
          })}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {allowlist.map((e) => (
        <AllowlistBalanceProbe
          key={e.tokenAddress}
          tokenAddress={e.tokenAddress}
          owner={address}
          decimals={e.decimals}
          onBalance={onBalance}
        />
      ))}

      {!treasuryAddress ? (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            {t('topup.externalTreasuryMissing', {
              defaultValue:
                'Treasury address not visible yet. Set chains.evm.treasuryAddress or NEXT_PUBLIC_EVM_TREASURY_ADDRESS.',
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {t('topup.oracleRateBubble', {
            symbol: nativeSymbol,
            rate: oracleRate ?? '…',
            creditUnit: creditBalanceUnit,
            defaultValue: `Tokens are calculated in accordance with exchange rate: 1 ${nativeSymbol} is ${oracleRate ?? '…'} ${creditBalanceUnit}.`,
          })}
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>{t('topup.externalSelectToken', { defaultValue: 'Token' })}</Label>
        <div className="space-y-2">
          {allowlist.map((e) => {
            const bal = balances[e.tokenAddress] ?? '0'
            const active = selected === e.tokenAddress
            return (
              <button
                key={e.tokenAddress}
                type="button"
                onClick={() => setSelected(e.tokenAddress)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      active ? 'border-primary' : 'border-muted-foreground',
                    )}
                  >
                    {active ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </span>
                  {e.symbol}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Number.parseFloat(bal).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="external-amount">
          {t('topup.externalAmount', { defaultValue: 'Amount' })}
        </Label>
        <div className="relative">
          <Input
            id="external-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pr-16"
            placeholder="0.00"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {selectedEntry?.symbol ?? '—'}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('topup.externalAvailable', {
            balance: selectedBalance,
            symbol: selectedEntry?.symbol ?? '',
            defaultValue: `Available: ${selectedBalance} ${selectedEntry?.symbol ?? ''}`,
          })}
        </p>
      </div>

      {quoting ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('swapQuoting', { defaultValue: 'Fetching quote…' })}
        </p>
      ) : null}
      {quoteError && !quoteOut ? (
        <p className="text-sm text-destructive">{quoteError}</p>
      ) : null}
      {quoteOut ? (
        <div className="rounded-lg bg-muted p-4 text-sm">
          <div className="flex justify-between font-medium">
            <span>{t('topup.externalYouReceive', { defaultValue: 'You receive ≈' })}</span>
            <span className="tabular-nums text-primary">
              {quoteOut} {nativeSymbol}
            </span>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="w-full"
        size="lg"
        disabled={!selected || !amount || Number.parseFloat(amount) <= 0}
        onClick={() => {
          if (onOpenSwap) onOpenSwap()
          else window.location.assign('../wallet')
        }}
      >
        {t('swapForNative', { symbol: nativeSymbol })}
      </Button>
    </div>
  )
}
