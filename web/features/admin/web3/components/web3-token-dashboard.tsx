'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Coins, Users, Wallet, Flame, Scale } from 'lucide-react'

type TokenSummary = {
  token: {
    symbol: string
    name: string
    decimals: number
    mintAddress: string
    treasuryAddress: string
    program: string
  }
  supply: { raw: string; ui: string }
  holders: { estimated: number; note: string }
  gas: { sol: number; lamports: number; address: string; healthy: boolean } | null
}

export function Web3TokenDashboard() {
  const t = useTranslations('modules.admin')
  const [data, setData] = useState<TokenSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Mint / Burn state ──
  const [mintAmount, setMintAmount] = useState('')
  const [burnAmount, setBurnAmount] = useState('')
  const [isMinting, startMint] = useTransition()
  const [isBurning, startBurn] = useTransition()
  const [txResult, setTxResult] = useState<{ type: 'mint' | 'burn'; txHash?: string; error?: string } | null>(null)
  const [diversifyHealth, setDiversifyHealth] = useState<{
    ready: boolean
    reason?: string
    allowlistCount: number
    healthyFeeds: number
  } | null>(null)
  const [isDiversifying, startDiversify] = useTransition()
  const [diversifyMsg, setDiversifyMsg] = useState<string | null>(null)

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/web3/token')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void (async () => {
      try {
        const res = await fetch('/api/admin/web3/treasury-diversify')
        if (!res.ok) return
        setDiversifyHealth(await res.json())
      } catch {
        /* non-blocking */
      }
    })()
  }, [load])

  const handleDiversify = () => {
    startDiversify(async () => {
      setDiversifyMsg(null)
      try {
        const res = await fetch('/api/admin/web3/treasury-diversify', { method: 'POST' })
        const json = await res.json()
        if (!json.success) {
          setDiversifyMsg(json.error ?? 'Diversify failed')
          if (json.health) setDiversifyHealth(json.health)
          return
        }
        setDiversifyMsg(
          json.status === 'plan_only'
            ? (t('diversifyPlanRecorded') ?? 'Equal-weight plan recorded (router auto-exec not configured).')
            : (t('diversifyExecuted') ?? 'Diversify executed'),
        )
        if (json.health) setDiversifyHealth(json.health)
      } catch (e) {
        setDiversifyMsg(e instanceof Error ? e.message : 'Diversify failed')
      }
    })
  }

  // ── Mint ──
  const handleMint = () => {
    startMint(async () => {
      setTxResult(null)
      try {
        const { adminMintRING } = await import('@/app/_actions/admin-web3')
        const result = await adminMintRING(mintAmount)
        if (result.success) {
          setTxResult({ type: 'mint', txHash: result.txHash })
          setMintAmount('')
          await load()
        } else {
          setTxResult({ type: 'mint', error: result.error })
        }
      } catch (e) {
        setTxResult({ type: 'mint', error: e instanceof Error ? e.message : 'Mint failed' })
      }
    })
  }

  // ── Burn ──
  const handleBurn = () => {
    startBurn(async () => {
      setTxResult(null)
      try {
        const { adminBurnRING } = await import('@/app/_actions/admin-web3')
        const result = await adminBurnRING(burnAmount)
        if (result.success) {
          setTxResult({ type: 'burn', txHash: result.txHash })
          setBurnAmount('')
          await load()
        } else {
          setTxResult({ type: 'burn', error: result.error })
        }
      } catch (e) {
        setTxResult({ type: 'burn', error: e instanceof Error ? e.message : 'Burn failed' })
      }
    })
  }

  // ── Short address ──
  const short = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Token Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> {data?.token.name ?? 'Native Token'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('tokenSymbol') ?? 'Symbol'}</p>
            <p className="font-mono font-semibold">{data?.token.symbol ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('tokenDecimals') ?? 'Decimals'}</p>
            <p className="font-mono font-semibold">{data?.token.decimals ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('tokenProgram') ?? 'Program'}</p>
            <p className="font-mono text-xs">{data?.token.program ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">{t('tokenMint') ?? 'Mint Address'}</p>
            <p className="font-mono text-xs break-all">{data?.token.mintAddress ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('tokenTreasury') ?? 'Treasury'}</p>
            <p className="font-mono text-xs">{short(data?.token.treasuryAddress ?? '')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Supply + Holders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('tokenTotalSupply') ?? 'Total Supply'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.supply.ui ?? '0'}</p>
            <p className="text-xs text-muted-foreground">{data?.supply.raw ?? '0'} raw</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> {t('tokenHolders') ?? 'Holders'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.holders.estimated ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{data?.holders.note ?? ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="h-4 w-4" /> {t('feePayerGas') ?? 'Fee Payer Gas'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.gas?.sol.toFixed(4) ?? '—'} SOL</p>
            <p className="text-xs font-mono">{short(data?.gas?.address ?? '')}</p>
            {data?.gas != null && (
              <Badge variant={data.gas.healthy ? 'default' : 'destructive'} className="mt-1 text-xs">
                {data.gas.healthy ? 'Healthy' : 'Low Gas'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Result */}
      {txResult && (
        <Alert variant={txResult.error ? 'destructive' : 'default'}>
          <AlertDescription>
            {txResult.error
              ? `${txResult.type === 'mint' ? 'Mint' : 'Burn'} failed: ${txResult.error}`
              : `${txResult.type === 'mint' ? 'Minted' : 'Burned'}! Tx: ${txResult.txHash?.slice(0, 12)}...`}
          </AlertDescription>
        </Alert>
      )}

      {/* Mint Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> {t('mintTokens') ?? 'Mint Tokens'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create new {data?.token.symbol ?? 'RING'} tokens into the treasury.
            Increases total supply. Requires superadmin + funded fee payer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="mint-amount">Amount ({data?.token.symbol ?? 'RING'})</Label>
              <Input
                id="mint-amount"
                type="number"
                min="1"
                step="1"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
            <Button
              onClick={handleMint}
              disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0}
              className="self-end"
            >
              {isMinting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('mint') ?? 'Mint'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Burn Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" /> {t('burnTokens') ?? 'Burn Tokens'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Destroy {data?.token.symbol ?? 'RING'} tokens from the treasury.
            Decreases total supply. Requires superadmin + funded fee payer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="burn-amount">Amount ({data?.token.symbol ?? 'RING'})</Label>
              <Input
                id="burn-amount"
                type="number"
                min="1"
                step="1"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="500"
              />
            </div>
            <Button
              onClick={handleBurn}
              disabled={isBurning || !burnAmount || parseFloat(burnAmount) <= 0}
              variant="destructive"
              className="self-end"
            >
              {isBurning ? <Loader2 className="h-4 w-4 animate-spin" /> : t('burn') ?? 'Burn'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diversify — equalize allowlisted non-native treasury holdings via oracle */}
      <Card className={diversifyHealth?.ready ? '' : 'border-dashed opacity-90'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> {t('diversifyTreasury') ?? 'Diversify'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('diversifyTreasuryHint') ??
              'Equalize treasury balances across allowlisted swap currencies (oracle-priced). Enabled when allowlist ≥ 2 and Chainlink feeds are healthy.'}
          </p>
          {diversifyHealth ? (
            <p className="text-xs text-muted-foreground">
              allowlist={diversifyHealth.allowlistCount} · healthyFeeds={diversifyHealth.healthyFeeds}
              {diversifyHealth.reason ? ` · ${diversifyHealth.reason}` : ''}
            </p>
          ) : null}
          {diversifyMsg ? <p className="text-sm">{diversifyMsg}</p> : null}
          <Button
            type="button"
            variant="outline"
            disabled={!diversifyHealth?.ready || isDiversifying}
            title={
              diversifyHealth?.ready
                ? undefined
                : (diversifyHealth?.reason ?? 'treasury_diversify_not_ready')
            }
            onClick={handleDiversify}
          >
            {isDiversifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : diversifyHealth?.ready ? (
              (t('diversifyRun') ?? 'Run diversify plan')
            ) : (
              (t('diversifyComingSoon') ?? 'Diversify (waiting on feeds)')
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
