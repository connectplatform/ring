'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type Web3Settings = {
  oracle: {
    nativePerMainCurrency: string
    mainCurrency?: string
    currencySymbol?: string
    tokenSymbol?: string
  }
  desk: Record<string, unknown>
  audit: Array<{ at: string; by: string; oldRate?: string; newRate: string }>
  gasReserve: { sol: number; address: string; healthy: boolean } | null
}

export function Web3SettingsContent() {
  const [data, setData] = useState<Web3Settings | null>(null)
  const [rate, setRate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fxStatus, setFxStatus] = useState<{
    feedFetchedAt?: string | null
    resolvedFeed?: { provider?: string; enabled?: boolean; refreshHours?: number } | null
    mainCurrency?: string
  } | null>(null)
  const [fxRefreshing, setFxRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, fxRes] = await Promise.all([
        fetch('/api/admin/web3/settings'),
        fetch('/api/admin/fx'),
      ])
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setData(json)
      setRate(json.oracle?.nativePerMainCurrency ?? '')
      if (fxRes.ok) {
        const fxJson = await fxRes.json()
        setFxStatus({
          feedFetchedAt: fxJson.feedFetchedAt,
          resolvedFeed: fxJson.resolvedFeed,
          mainCurrency: fxJson.mainCurrency,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveRate = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/web3/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nativePerMainCurrency: rate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const refreshFx = async () => {
    setFxRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/fx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'FX refresh failed')
      setFxStatus((prev) => ({
        ...prev,
        feedFetchedAt: json.fetchedAt,
        resolvedFeed: json.resolvedFeed ?? prev?.resolvedFeed,
        mainCurrency: json.mainCurrency ?? prev?.mainCurrency,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FX refresh failed')
    } finally {
      setFxRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const main = data?.oracle.mainCurrency ?? data?.oracle.currencySymbol ?? 'USD'
  const native = data?.oracle.tokenSymbol ?? 'RING'

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Native token desk oracle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rate = main-currency units ({main}) per 1 native token ({native}). Credit-balance
            points convert via credit.creditBalanceUnitToMainCurrency, then this desk rate.
          </p>
          <div className="flex flex-col gap-2 max-w-sm">
            <Label htmlFor="nativePerMainCurrency">
              {main} per 1 {native}
            </Label>
            <Input
              id="nativePerMainCurrency"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <Button onClick={() => void saveRate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save rate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fiat FX feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Main currency {fxStatus?.mainCurrency ?? '—'}: UAH uses NBU; other mains use open.er-api
            (global free FX). Override per main via ring-config.fx.byMainCurrency.
            Manual overrides in fx.manualOverrides always win.
          </p>
          <p>
            Resolved provider: {fxStatus?.resolvedFeed?.provider ?? '—'} · Enabled:{' '}
            {fxStatus?.resolvedFeed?.enabled === false ? 'no' : 'yes'} · Refresh hours:{' '}
            {fxStatus?.resolvedFeed?.refreshHours ?? 24}
          </p>
          <p>Last fetch: {fxStatus?.feedFetchedAt ?? '—'}</p>
          <Button type="button" variant="outline" onClick={() => void refreshFx()} disabled={fxRefreshing}>
            {fxRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh FX feed'}
          </Button>
        </CardContent>
      </Card>

      {data?.gasReserve && (
        <Card>
          <CardHeader>
            <CardTitle>Fee payer gas reserve</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Address: {data.gasReserve.address}</p>
            <p>SOL balance: {data.gasReserve.sol}</p>
            <p>Healthy: {data.gasReserve.healthy ? 'yes' : 'no'}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate audit log</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.audit ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate changes yet.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {data!.audit.map((row) => (
                <li key={`${row.at}-${row.by}-${row.newRate}`}>
                  {row.at}: {row.oldRate ?? '?'} → {row.newRate} by {row.by}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
