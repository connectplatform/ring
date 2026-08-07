'use client'

/**
 * Lane C — browser-connected sign-in wallet row on /wallet.
 * Wagmi balances + treasury swap (allowlisted ERC-20 → custodial native RING).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { erc20Abi, formatUnits, parseUnits } from 'viem'
import { ArrowLeftRight, Check, Copy, Loader2, Wallet } from 'lucide-react'
import {
  useBalance,
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from '@/lib/wagmi-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  DavinciGlassChip,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import {
  getClientMainCurrency,
  getClientEvmTreasuryAddress,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import {
  getNativeTokenSwapAllowlist,
  hasSwapEligibleAssets,
  type SignInWalletSwapAsset,
} from '@/features/wallet/lib/native-token-swap-stubs'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'

export type SignInWalletListItemProps = {
  className?: string
}

function formatAddr(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function AllowlistTokenBalance({
  tokenAddress,
  owner,
  decimals,
  onBalance,
}: {
  tokenAddress: `0x${string}`
  owner: `0x${string}`
  decimals: number
  onBalance: (tokenAddress: string, balance: string) => void
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

export default function SignInWalletListItem({ className }: SignInWalletListItemProps) {
  const t = useTranslations('modules.wallet')
  const nativeSymbol = getClientNativeTokenSymbol()
  const treasuryAddress = getClientEvmTreasuryAddress()
  const { address, isConnected } = useConnection()
  const { data: gasBalance, isLoading: gasLoading } = useBalance({
    address: address ?? undefined,
  })
  const [copied, setCopied] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [erc20Balances, setErc20Balances] = useState<Record<string, string>>({})
  const [selectedToken, setSelectedToken] = useState<`0x${string}` | null>(null)
  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState<{
    quoteToken: string
    amountOut: string
    mainCurrencyNotional: string
    mainCurrency: string
    expiresAt: number
    treasuryAddress: string
  } | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [execError, setExecError] = useState<string | null>(null)
  const [execSuccess, setExecSuccess] = useState<string | null>(null)

  const { writeContractAsync, data: depositHash, isPending: isWriting } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  const allowlist = useMemo(() => getNativeTokenSwapAllowlist(), [])

  const onBalance = useCallback((tokenAddress: string, balance: string) => {
    setErc20Balances((prev) => {
      if (prev[tokenAddress] === balance) return prev
      return { ...prev, [tokenAddress]: balance }
    })
  }, [])

  const assets: SignInWalletSwapAsset[] = useMemo(() => {
    if (!address || !isConnected) return []
    const gasFormatted =
      gasBalance != null
        ? formatUnits(gasBalance.value, gasBalance.decimals)
        : '0'
    const gasAsset: SignInWalletSwapAsset = {
      tokenAddress: 'native',
      symbol: gasBalance?.symbol ?? 'ETH',
      balance: gasFormatted,
      decimals: gasBalance?.decimals ?? 18,
      swapListed: false,
    }
    const listed: SignInWalletSwapAsset[] = allowlist.map((e) => ({
      tokenAddress: e.tokenAddress,
      symbol: e.symbol,
      balance: erc20Balances[e.tokenAddress] ?? '0',
      decimals: e.decimals,
      swapListed: true,
    }))
    return [gasAsset, ...listed]
  }, [address, isConnected, gasBalance, allowlist, erc20Balances])

  const eligible = useMemo(
    () => assets.filter((a) => a.swapListed && Number.parseFloat(a.balance) > 0),
    [assets],
  )
  const showSwap = hasSwapEligibleAssets(assets)

  useEffect(() => {
    if (swapOpen && !selectedToken && eligible[0]?.tokenAddress !== 'native') {
      setSelectedToken(eligible[0]?.tokenAddress as `0x${string}`)
    }
  }, [swapOpen, selectedToken, eligible])

  const selectedAsset = eligible.find((a) => a.tokenAddress === selectedToken)

  const fetchQuote = useCallback(async () => {
    if (!address || !selectedToken || !amountIn) return
    setQuoting(true)
    setQuoteError(null)
    setQuote(null)
    try {
      const res = await fetch('/api/wallet/treasury-swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTokenAddress: selectedToken,
          amountIn,
          signInAddress: address,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Quote failed')
      }
      setQuote({
        quoteToken: data.quoteToken,
        amountOut: data.amountOut,
        mainCurrencyNotional: data.mainCurrencyNotional,
        mainCurrency: data.mainCurrency ?? getClientMainCurrency(),
        expiresAt: data.expiresAt,
        treasuryAddress: data.treasuryAddress,
      })
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : 'Quote failed')
    } finally {
      setQuoting(false)
    }
  }, [address, selectedToken, amountIn])

  useEffect(() => {
    if (!swapOpen || !selectedToken || !amountIn || Number.parseFloat(amountIn) <= 0) {
      setQuote(null)
      return
    }
    const tmr = setTimeout(() => {
      void fetchQuote()
    }, 400)
    return () => clearTimeout(tmr)
  }, [swapOpen, selectedToken, amountIn, fetchQuote])

  useEffect(() => {
    if (!isConfirmed || !depositHash || !quote || !address) return
    let cancelled = false
    ;(async () => {
      setExecuting(true)
      setExecError(null)
      try {
        const res = await fetch('/api/wallet/treasury-swap/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteToken: quote.quoteToken,
            depositTxHash: depositHash,
            signInAddress: address,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Execute failed')
        if (!cancelled) {
          setExecSuccess(
            t('swapSuccess', {
              defaultValue: 'Received {amount} {symbol}',
              amount: data.amountOut,
              symbol: nativeSymbol,
            }),
          )
        }
      } catch (e) {
        if (!cancelled) {
          setExecError(e instanceof Error ? e.message : 'Execute failed')
        }
      } finally {
        if (!cancelled) setExecuting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isConfirmed, depositHash, quote, address, nativeSymbol, t])

  const onConfirmSwap = async () => {
    if (!quote || !selectedToken || !selectedAsset || !address) return
    const to = (quote.treasuryAddress || treasuryAddress) as `0x${string}` | null
    if (!to) {
      setExecError(t('swapTreasuryMissing', { defaultValue: 'Treasury address not configured' }))
      return
    }
    setExecError(null)
    setExecSuccess(null)
    try {
      const value = parseUnits(amountIn, selectedAsset.decimals)
      await writeContractAsync({
        address: selectedToken,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, value],
      } as never)
    } catch (e) {
      setExecError(e instanceof Error ? e.message : 'Transfer failed')
    }
  }

  const quoteValid =
    quote != null &&
    Date.now() < quote.expiresAt &&
    !quoteError &&
    Number.parseFloat(amountIn) > 0

  if (!isConnected || !address) {
    return (
      <BorderBeam
        disabled
        className={cn(davinciGlassSurface, 'rounded-[15px]', className)}
        innerClassName={cn(
          davinciBeamInnerSurface,
          'flex items-center gap-3 p-3.5 text-sm text-muted-foreground',
        )}
      >
        <Wallet className="h-4 w-4 shrink-0 opacity-60" />
        <span>{t('signinWalletDisconnected')}</span>
      </BorderBeam>
    )
  }

  const gasDisplay = (() => {
    if (gasLoading) return '…'
    if (!gasBalance) return '—'
    const formatted = formatUnits(gasBalance.value, gasBalance.decimals)
    return `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${gasBalance.symbol}`
  })()

  const listedDisplay = allowlist
    .map((e) => {
      const bal = erc20Balances[e.tokenAddress] ?? '0'
      const n = Number.parseFloat(bal)
      if (!Number.isFinite(n) || n <= 0) return null
      return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${e.symbol}`
    })
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      {allowlist.map((e) => (
        <AllowlistTokenBalance
          key={e.tokenAddress}
          tokenAddress={e.tokenAddress}
          owner={address}
          decimals={e.decimals}
          onBalance={onBalance}
        />
      ))}

      <BorderBeam
        disabled
        className={cn(davinciGlassSurface, davinciAuthButtonLift, 'rounded-[15px]', className)}
        innerClassName={cn(davinciBeamInnerSurface, 'p-3.5 sm:p-4')}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[99px]',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]',
              'text-[var(--davinci-beam)]',
            )}
            aria-hidden
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {t('signinWallet')}
              </span>
              <DavinciGlassChip className="uppercase tracking-wide">EVM</DavinciGlassChip>
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate font-mono text-xs text-muted-foreground">
                {formatAddr(address)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 rounded-[99px] p-0 text-muted-foreground hover:text-[var(--davinci-beam)]"
                aria-label={t('copyAddress')}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[var(--davinci-beam)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-sm font-semibold tabular-nums text-foreground">{gasDisplay}</p>
            {listedDisplay ? (
              <p className="text-xs tabular-nums text-muted-foreground">{listedDisplay}</p>
            ) : null}
          </div>
          {showSwap ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-[99px] text-xs"
              onClick={() => {
                setSwapOpen(true)
                setExecSuccess(null)
                setExecError(null)
              }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {t('swapForNative', { symbol: nativeSymbol })}
            </Button>
          ) : null}
        </div>
      </BorderBeam>

      <WalletFsModal
        open={swapOpen}
        onOpenChange={setSwapOpen}
        title={t('swapForNative', { symbol: nativeSymbol })}
      >
        <div className="space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-muted-foreground">
            {t('swapHint', {
              defaultValue:
                'Transfer an allowlisted token to the treasury. Custodial {symbol} is credited at the signed oracle quote.',
              symbol: nativeSymbol,
            })}
          </p>

          {eligible.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {eligible.map((a) => (
                <Button
                  key={String(a.tokenAddress)}
                  type="button"
                  size="sm"
                  variant={selectedToken === a.tokenAddress ? 'default' : 'outline'}
                  onClick={() => setSelectedToken(a.tokenAddress as `0x${string}`)}
                >
                  {a.symbol}
                </Button>
              ))}
            </div>
          ) : null}

          {selectedAsset ? (
            <p className="text-xs text-muted-foreground">
              {t('swapAvailable', {
                defaultValue: 'Available: {balance} {symbol}',
                balance: selectedAsset.balance,
                symbol: selectedAsset.symbol,
              })}
            </p>
          ) : null}

          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={t('swapAmountPlaceholder', { defaultValue: 'Amount' })}
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />

          {quoting ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('swapQuoting', { defaultValue: 'Fetching quote…' })}
            </p>
          ) : null}
          {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}
          {quote && !quoteError ? (
            <p className="text-sm font-medium tabular-nums">
              {t('swapYouReceive', {
                defaultValue: 'You receive ≈ {amount} {symbol} ({notional} {currency})',
                amount: quote.amountOut,
                symbol: nativeSymbol,
                notional: Number(quote.mainCurrencyNotional).toFixed(2),
                currency: quote.mainCurrency,
                usd: Number(quote.mainCurrencyNotional).toFixed(2),
              })}
            </p>
          ) : null}
          {execError ? <p className="text-sm text-destructive">{execError}</p> : null}
          {execSuccess ? <p className="text-sm text-emerald-600">{execSuccess}</p> : null}

          <Button
            type="button"
            className="w-full"
            disabled={
              !quoteValid ||
              isWriting ||
              isConfirming ||
              executing ||
              !(treasuryAddress || quote?.treasuryAddress)
            }
            onClick={() => void onConfirmSwap()}
          >
            {isWriting || isConfirming || executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('swapConfirm', { defaultValue: 'Confirm swap' })
            )}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setSwapOpen(false)}>
            {t('close')}
          </Button>
        </div>
      </WalletFsModal>
    </>
  )
}
