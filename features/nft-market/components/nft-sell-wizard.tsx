'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { listGateListingAction } from '@/app/_actions/nft-market'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftGateTemplate, NftOwnershipRecord } from '@/features/nft-gates/types'

function assetLabel(asset: string) {
  return asset.length > 18 ? `${asset.slice(0, 8)}...${asset.slice(-6)}` : asset
}

export function NftSellWizard({
  locale,
  owned,
  templates,
  username,
}: {
  locale: Locale
  owned: NftOwnershipRecord[]
  templates: NftGateTemplate[]
  username?: string
}) {
  const [state, formAction, pending] = useActionState(listGateListingAction, null)
  const eligible = useMemo(
    () =>
      owned.filter((item) => {
        const template = templates.find((t) => t.slug === item.slug)
        return template && !template.soulbound && !item.soulbound
      }),
    [owned, templates],
  )
  const [selectedAsset, setSelectedAsset] = useState(eligible[0]?.asset || '')
  const selectedOwnership = eligible.find((item) => item.asset === selectedAsset)
  const selectedTemplate = templates.find((template) => template.slug === selectedOwnership?.slug)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <RingBreadcrumbs
        items={[
          { label: 'NFT Exhibition', href: ROUTES.NFT_MARKET(locale) },
          { label: 'Sell gate' },
        ]}
      />

      <div>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Seller console</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">List an eligible KEYS gate</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Select an owned, tradeable gate NFT, set a RING price, and activate the marketplace listing.
        </p>
      </div>

      {eligible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No eligible gates to list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Membership and soulbound gates cannot be listed. Buy or unstake a tradeable vendor gate first.
            </p>
            <Button asChild>
              <Link href={ROUTES.NFT_GATES(locale)}>View NFT gates</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Listing wizard</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form action={formAction} className="space-y-6">
              {state?.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              {state?.success ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Listing activated.{' '}
                    {state.id ? (
                      <Link href={ROUTES.NFT_MARKET_LISTING(state.id, locale)} className="font-medium underline">
                        View listing
                      </Link>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <input type="hidden" name="slug" value={selectedOwnership?.slug || ''} />
              {username ? <input type="hidden" name="sellerUsername" value={username} /> : null}

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  <Label htmlFor="asset">Owned gate asset</Label>
                  <select
                    id="asset"
                    name="asset"
                    value={selectedAsset}
                    onChange={(event) => setSelectedAsset(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    {eligible.map((item) => (
                      <option key={item.id} value={item.asset}>
                        {item.slug} · {assetLabel(item.asset)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceRing">RING price</Label>
                  <Input id="priceRing" name="priceRing" type="number" min="0.01" step="0.01" required placeholder="125" />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="font-medium">{selectedTemplate?.name || selectedOwnership?.slug}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate?.description || 'Verified KEYS gate asset'}
                </p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">{selectedOwnership?.asset}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="imageUri">Image URL override</Label>
                  <Input id="imageUri" name="imageUri" type="url" defaultValue={selectedOwnership?.imageUri || ''} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseExpiresAt">License expiry</Label>
                  <Input id="licenseExpiresAt" name="licenseExpiresAt" type="datetime-local" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metadataUri">Metadata URI</Label>
                <Input id="metadataUri" name="metadataUri" placeholder="ipfs://... or https://..." />
              </div>

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Activating listing...' : 'Create and activate listing'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
