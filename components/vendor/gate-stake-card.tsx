'use client'

/**
 * GateStakeCard — stake/unstake GateEscrow assets (not NATIVE_NFT_APR / DAARION mock).
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Lock, Unlock } from 'lucide-react'
import { stakeGateAction, unstakeGateAction } from '@/app/_actions/nft-gates'
import type { NftGateSlug } from '@/features/nft-gates/types'
import type { NftOwnershipRecord, NftStakeRecord } from '@/features/nft-gates/types'

interface GateStakeCardProps {
  owned: NftOwnershipRecord[]
  stakes: NftStakeRecord[]
  /** Highlight this slug (e.g. vendor-dagi-key on vendor dashboard). */
  focusSlug?: NftGateSlug
}

export function GateStakeCard({ owned, stakes, focusSlug }: GateStakeCardProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busyAsset, setBusyAsset] = useState<string | null>(null)

  const activeAssets = new Set(stakes.map((s) => s.asset))
  const rows = focusSlug ? owned.filter((o) => o.slug === focusSlug) : owned

  function onStake(asset: string, slug: NftGateSlug) {
    setError(null)
    setBusyAsset(asset)
    startTransition(async () => {
      const result = await stakeGateAction(asset, slug)
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
      {rows.map((item) => {
        const staked = activeAssets.has(item.asset)
        const busy = pending && busyAsset === item.asset
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
              <Button disabled={busy} onClick={() => onStake(item.asset, item.slug)}>
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
