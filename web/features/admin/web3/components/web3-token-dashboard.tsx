'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Coins, Users, Wallet, Flame, Scale } from 'lucide-react'

type TokenMintEventRow = {
  id: string
  projectId: string
  superadminUserId: string
  superadminEmail: string | null
  amount: string
  destination: string
  txSignature: string | null
  note: string | null
  status: 'pending' | 'confirmed' | 'failed'
  createdAt: string
  explorerUrl: string | null
}

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
  cluster?: string
  recentMints?: TokenMintEventRow[]
  recentMintsUnavailable?: boolean
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '-'
}

function amountStep(decimals: number | undefined): string {
  if (decimals == null || decimals < 0) return 'any'
  if (decimals === 0) return '1'
  return (1 / 10 ** decimals).toFixed(decimals)
}

export function Web3TokenDashboard() {
  const t = useTranslations('modules.admin')
  const tw = useTranslations('modules.admin.web3')
  const [data, setData] = useState<TokenSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mintAmount, setMintAmount] = useState('')
  const [mintNote, setMintNote] = useState('')
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

  const symbol = data?.token.symbol ?? ''

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

  const handleMint = () => {
    startMint(async () => {
      setTxResult(null)
      try {
        const { adminMintNativeToken } = await import('@/app/_actions/admin-web3')
        const result = await adminMintNativeToken(mintAmount, mintNote)
        if (result.success) {
          setTxResult({ type: 'mint', txHash: result.txHash })
          setMintAmount('')
          setMintNote('')
          await load()
        } else {
          setTxResult({ type: 'mint', error: result.error })
        }
      } catch (e) {
        setTxResult({ type: 'mint', error: e instanceof Error ? e.message : 'Mint failed' })
      }
    })
  }

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

  const statusLabel = (status: TokenMintEventRow['status']) => {
    if (status === 'confirmed') return tw('statusConfirmed')
    if (status === 'failed') return tw('statusFailed')
    return tw('statusPending')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const recentMints = data?.recentMints ?? []
  const amountMin = data?.token.decimals ? amountStep(data.token.decimals) : 'any'

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> {data?.token.name ?? symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{tw('tokenSymbol')}</p>
            <p className="font-mono font-semibold">{data?.token.symbol ?? '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{tw('tokenDecimals')}</p>
            <p className="font-mono font-semibold">{data?.token.decimals ?? '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{tw('tokenProgram')}</p>
            <p className="font-mono text-xs">{data?.token.program ?? '-'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">{tw('tokenMint')}</p>
            <p className="font-mono text-xs break-all">{data?.token.mintAddress ?? '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{tw('tokenTreasury')}</p>
            <p className="font-mono text-xs">{shortAddr(data?.token.treasuryAddress ?? '')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tw('onChainTotalSupply')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data?.supply.ui ?? '0'} {symbol}
            </p>
            <p className="text-xs text-muted-foreground">{data?.supply.raw ?? '0'} raw</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> {tw('tokenHolders')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.holders.estimated ?? '-'}</p>
            <p className="text-xs text-muted-foreground">{data?.holders.note ?? ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="h-4 w-4" /> {tw('feePayerGas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.gas?.sol.toFixed(4) ?? '-'} SOL</p>
            <p className="text-xs font-mono">{shortAddr(data?.gas?.address ?? '')}</p>
            {data?.gas != null && (
              <Badge variant={data.gas.healthy ? 'default' : 'destructive'} className="mt-1 text-xs">
                {data.gas.healthy ? 'Healthy' : 'Low Gas'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {txResult && (
        <Alert variant={txResult.error ? 'destructive' : 'default'}>
          <AlertDescription>
            {txResult.type === 'mint'
              ? txResult.error
                ? tw('mintFailed', { error: txResult.error })
                : tw('mintSuccess', { tx: `${txResult.txHash?.slice(0, 12) ?? ''}...` })
              : txResult.error
                ? tw('burnFailed', { error: txResult.error })
                : tw('burnSuccess', { tx: `${txResult.txHash?.slice(0, 12) ?? ''}...` })}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> {tw('mintTokens')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{tw('mintHint', { symbol })}</p>
          <div className="flex flex-col gap-3 max-w-md">
            <div>
              <Label htmlFor="mint-amount">{tw('amountLabel', { symbol })}</Label>
              <Input
                id="mint-amount"
                type="number"
                min={amountMin === 'any' ? undefined : amountMin}
                step={amountStep(data?.token.decimals)}
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div>
              <Label htmlFor="mint-note">{tw('mintNote')}</Label>
              <Textarea
                id="mint-note"
                value={mintNote}
                onChange={(e) => setMintNote(e.target.value)}
                placeholder={tw('mintNotePlaceholder')}
                rows={3}
              />
            </div>
            <Button
              onClick={handleMint}
              disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0 || !mintNote.trim()}
              className="self-start"
            >
              {isMinting ? <Loader2 className="h-4 w-4 animate-spin" /> : tw('mint')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" /> {tw('burnTokens')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{tw('burnHint', { symbol })}</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="burn-amount">{tw('amountLabel', { symbol })}</Label>
              <Input
                id="burn-amount"
                type="number"
                min={amountMin === 'any' ? undefined : amountMin}
                step={amountStep(data?.token.decimals)}
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
              {isBurning ? <Loader2 className="h-4 w-4 animate-spin" /> : tw('burn')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tw('recentMints')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentMintsUnavailable ? (
            <p className="text-sm text-muted-foreground">{tw('recentMintsUnavailable')}</p>
          ) : recentMints.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tw('recentMintsEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{tw('mintEventTime')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventProject')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventWho')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventAmount')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventDestination')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventTx')}</th>
                    <th className="py-2 pr-3 font-medium">{tw('mintEventNote')}</th>
                    <th className="py-2 font-medium">{tw('mintEventStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMints.map((event) => (
                    <tr key={event.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{event.projectId}</td>
                      <td className="py-2 pr-3">
                        <div>{event.superadminEmail || event.superadminUserId}</div>
                        {event.superadminEmail ? (
                          <div className="font-mono text-xs text-muted-foreground">
                            {shortAddr(event.superadminUserId)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {event.amount} {symbol}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{shortAddr(event.destination)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {event.txSignature ? (
                          event.explorerUrl ? (
                            <a
                              href={event.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                              title={tw('viewOnExplorer')}
                            >
                              {shortAddr(event.txSignature)}
                            </a>
                          ) : (
                            shortAddr(event.txSignature)
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 pr-3 max-w-xs break-words">{event.note || '-'}</td>
                      <td className="py-2">
                        <Badge
                          variant={
                            event.status === 'failed'
                              ? 'destructive'
                              : event.status === 'confirmed'
                                ? 'default'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {statusLabel(event.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
