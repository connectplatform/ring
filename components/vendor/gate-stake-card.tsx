'use client'

/**
 * GateStakeCard — stake/unstake GateEscrow assets (not NATIVE_NFT_APR / DAARION mock).
 * DAGI / vendor.dagi stakes require vendorEntityId (owned) — multi-entity picker supported.
 */

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Lock, Unlock } from 'lucide-react'
import { stakeGateAction, unstakeGateAction } from '@/app/_actions/nft-gates'
import type { NftGateSlug } from '@/features/nft-gates/types'
import type { NftOwnershipRecord, NftStakeRecord } from '@/features/nft-gates/types'

export type VendorEntityOption = { id: string; name: string }

interface GateStakeCardProps {
  owned: NftOwnershipRecord[]
  stakes: NftStakeRecord[]
  /** Highlight this slug (e.g. vendor-dagi-key on vendor dashboard). */
  focusSlug?: NftGateSlug
  /** Owned vendor entities for DAGI stake-time bind (required when staking vendor-dagi-key). */
  vendorEntities?: VendorEntityOption[]
}

export function GateStakeCard({
  owned,
  stakes,
  focusSlug,
  vendorEntities = [],
}: GateStakeCardProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busyAsset, setBusyAsset] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    vendorEntities[0]?.id || '',
  )

  const activeAssets = new Set(stakes.map((s) => s.asset))
  const gateOwned = owned.filter((o) => o.source !== 'member_mint')
  const rows = focusSlug ? gateOwned.filter((o) => o.slug === focusSlug) : gateOwned

  const needsEntityPicker = useMemo(() => {
    if (focusSlug === 'vendor-dagi-key') return true
    return rows.some((r) => r.slug === 'vendor-dagi-key')
  }, [focusSlug, rows])

  function onStake(asset: string, slug: string) {
    setError(null)
    setBusyAsset(asset)
    const vendorEntityId =
      slug === 'vendor-dagi-key' || needsEntityPicker ? selectedEntityId || undefined : undefined
    startTransition(async () => {
      const result = await stakeGateAction(asset, slug as NftGateSlug, vendorEntityId)
      if (!result.success) setError(result.error || 'Stake failed')
      setBusyAsset(null)
    })
  }

  function onUnstake(asset: string) {
    setError(null)
    setBusyAsset(asset)
    startTransition(async () => {
      const result = await unstakeGateAction(asset)
      if (!result.success) setError(result.error || 'Unstake failed')
      setBusyAsset(null)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No gate NFTs to stake
        {focusSlug ? ` for ${focusSlug}` : ''}. Buy one on the NFT gates page.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {needsEntityPicker && vendorEntities.length > 1 ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label htmlFor="dagi-vendor-entity">Bind DAGI stake to vendor store</Label>
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger id="dagi-vendor-entity">
              <SelectValue placeholder="Select vendor store" />
            </SelectTrigger>
            <SelectContent>
              {vendorEntities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name || e.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Tradeable keys rebind on stake to your owned store — never unlock a previous owner&apos;s
            ERP.
          </p>
        </div>
      ) : null}

      {needsEntityPicker && vendorEntities.length === 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Activate a vendor store before staking DAGI — stake binds to your vendorEntityId.
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.map((item) => {
        const staked = activeAssets.has(item.asset)
        const busy = pending && busyAsset === item.asset
        const stakeMeta = stakes.find((s) => s.asset === item.asset && !s.unstakedAt)
        return (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.slug}</span>
                {item.soulbound && <Badge variant="secondary">Soulbound</Badge>}
                {staked ? (
                  <Badge>Staked</Badge>
                ) : (
                  <Badge variant="outline">Unstaked</Badge>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all">{item.asset}</p>
              {stakeMeta?.vendorEntityId ? (
                <p className="text-xs text-muted-foreground">
                  Bound store: {stakeMeta.vendorEntityId}
                </p>
              ) : null}
            </div>
            {staked ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onUnstake(item.asset)}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="mr-2 h-4 w-4" />
                )}
                Unstake
              </Button>
            ) : (
              <Button
                disabled={
                  busy ||
                  (item.slug === 'vendor-dagi-key' &&
                    (vendorEntities.length === 0 ||
                      (vendorEntities.length > 1 && !selectedEntityId)))
                }
                onClick={() => onStake(item.asset, item.slug)}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Stake to unlock
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** @deprecated Prefer GateStakeCard — kept for import compatibility during migration. */
export { GateStakeCard as StakingCard }
