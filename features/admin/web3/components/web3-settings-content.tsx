'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type Web3Settings = {
  oracle: { ringPerUsd: string; creditFiatCurrency: string }
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/web3/settings')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setData(json)
      setRate(json.oracle?.ringPerUsd ?? '')
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
        body: JSON.stringify({ ringPerUsd: rate }),
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Ring Oracle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Credit balance is denominated in {data?.oracle.creditFiatCurrency ?? 'USD'} fiat — never
            RING. Rate = RING tokens per 1 {data?.oracle.creditFiatCurrency ?? 'USD'} credit.
          </p>
          <div className="flex flex-col gap-2 max-w-sm">
            <Label htmlFor="ringPerUsd">RING per 1 USD credit</Label>
            <Input
              id="ringPerUsd"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <Button onClick={() => void saveRate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save rate'}
            </Button>
          </div>
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
              {data!.audit
                .slice()
                .reverse()
                .map((row) => (
                  <li key={`${row.at}-${row.newRate}`}>
                    {row.at}: {row.oldRate ?? '—'} → {row.newRate} (by {row.by})
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
