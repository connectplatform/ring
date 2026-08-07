'use client'

/**
 * NFT Gate listing + buy CTA (primary sale with RING transferChecked).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, KeyRound } from 'lucide-react'
import { purchaseGateAction } from '@/app/_actions/nft-gates'
import { GateStakeCard } from '@/components/vendor/gate-stake-card'
import type { NftGateTemplate } from '@/lib/ring-config-types'
import type { NftOwnershipRecord, NftStakeRecord } from '@/features/nft-gates/types'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

interface NftGatesClientProps {
  locale: Locale
  templates: NftGateTemplate[]
  owned: NftOwnershipRecord[]
  stakes: NftStakeRecord[]
  tokenSymbol: string
  signedIn: boolean
}

export function NftGatesClient({
  locale,
  templates,
  owned,
  stakes,
  tokenSymbol,
  signedIn,
}: NftGatesClientProps) {
  const searchParams = useSearchParams()
  const highlight = searchParams.get('slug')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const ordered = useMemo(() => {
    if (!highlight) return templates
    return [...templates].sort((a, b) => {
      if (a.slug === highlight) return -1
      if (b.slug === highlight) return 1
      return 0
    })
  }, [templates, highlight])

  function onBuy(slug: NftGateTemplate['slug']) {
    setError(null)
    setMessage(null)
    setBusySlug(slug)
    startTransition(async () => {
      const result = await purchaseGateAction(slug)
      if (!result.success) {
        setError(('error' in result && result.error) || 'Purchase failed')
      } else {
        setMessage(`Purchased ${slug}. Membership gates auto-stake; vendor keys need explicit stake.`)
      }
      setBusySlug(null)
    })
  }

  return (
    <div className="space-y-10">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ordered.map((template) => {
          const busy = pending && busySlug === template.slug
          const highlighted = highlight === template.slug
          return (
            <div
              key={template.slug}
              className={`rounded-xl border p-5 space-y-3 ${highlighted ? 'border-primary ring-1 ring-primary/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{template.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                </div>
                <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
              <div className="flex flex-wrap gap-2">
                {template.soulbound ? (
                  <Badge variant="secondary">Soulbound</Badge>
                ) : (
                  <Badge variant="outline">Tradeable later</Badge>
                )}
                {template.durationDays != null && (
                  <Badge variant="outline">{template.durationDays}d</Badge>
                )}
                {template.gateFeatures.map((f) => (
                  <Badge key={f} variant="outline">
                    {f}
                  </Badge>
                ))}
              </div>
              <p className="text-2xl font-semibold">
                {template.priceRing}{' '}
                <span className="text-base font-normal text-muted-foreground">{tokenSymbol}</span>
              </p>
              {signedIn ? (
                <Button className="w-full" disabled={busy} onClick={() => onBuy(template.slug)}>
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buying…
                    </>
                  ) : (
                    `Buy with ${tokenSymbol}`
                  )}
                </Button>
              ) : (
                <Button asChild className="w-full" variant="outline">
                  <Link href={ROUTES.LOGIN(locale)}>Sign in to buy</Link>
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {signedIn && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your gate stakes</h2>
          <p className="text-sm text-muted-foreground">
            Staking into GateEscrow unlocks features. Unstake or burn revokes entitlement cache.
          </p>
          <GateStakeCard owned={owned} stakes={stakes} />
        </section>
      )}
    </div>
  )
}
