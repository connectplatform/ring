'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import {
  createMemberCollectionAction,
  listMemberAssetAction,
  mintMemberAssetAction,
  type NftMemberActionState,
} from '@/app/_actions/nft-member'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftMemberCollection } from '@/features/nft-market/types'
import type { NftOwnershipRecord } from '@/features/nft-gates/types'
import { GenerativeMediaField } from '@/features/generative-media/components/generative-media-field'

function ActionAlert({ state }: { state: NftMemberActionState | null }) {
  if (!state) return null
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )
  }
  if (state.success) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>{state.message || 'Done'}</AlertDescription>
      </Alert>
    )
  }
  return null
}

export function NftCreateWizard({
  locale,
  collections,
  mints,
}: {
  locale: Locale
  collections: NftMemberCollection[]
  mints: NftOwnershipRecord[]
}) {
  const [createState, createAction, createPending] = useActionState(createMemberCollectionAction, null)
  const [mintState, mintAction, mintPending] = useActionState(mintMemberAssetAction, null)
  const [listState, listAction, listPending] = useActionState(listMemberAssetAction, null)
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || '')
  const [selectedAsset, setSelectedAsset] = useState(
    mints.find((m) => m.collectionId === collections[0]?.id)?.asset || mints[0]?.asset || '',
  )

  const collectionMints = mints.filter((m) => !selectedCollectionId || m.collectionId === selectedCollectionId)
  const selectedMint = collectionMints.find((m) => m.asset === selectedAsset) || collectionMints[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <RingBreadcrumbs
        items={[
          { label: 'NFT Exhibition', href: ROUTES.NFT_MARKET(locale) },
          { label: 'Create' },
        ]}
      />

      <div>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Member creator lane</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Create collection and mint</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          On-platform Metaplex Core collections. Mint tradeable assets, then list them on the Exhibition Marketplace
          for RING. KEYS vendor gates remain a verified separate lane.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle>1. Create collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <ActionAlert state={createState} />
          <form action={createAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={32} placeholder="My Ring Art" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" name="symbol" maxLength={10} placeholder="ART" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <GenerativeMediaField
              name="imageUri"
              scope="nft"
              fieldId="collection-cover"
              pageSlug="nft-create"
              purpose="nft-member-collection-cover"
              actionUrl="/nft/create"
            />
            <Button type="submit" disabled={createPending} className="md:col-span-2">
              {createPending ? 'Creating...' : 'Create collection'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
          {createState?.collectionId ? (
            <Button asChild variant="outline">
              <Link href={ROUTES.NFT_CREATE_COLLECTION(createState.collectionId, locale)}>
                Open collection
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle>2. Mint into a collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <ActionAlert state={mintState} />
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a collection first.</p>
          ) : (
            <form action={mintAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="collectionId">Collection</Label>
                <select
                  id="collectionId"
                  name="collectionId"
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.symbol} ({c.mintCount}/{c.maxMints})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mint-name">Asset name</Label>
                <Input id="mint-name" name="name" required maxLength={32} placeholder="Edition #1" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mint-description">Description</Label>
                <Textarea id="mint-description" name="description" rows={2} />
              </div>
              <GenerativeMediaField
                name="imageUri"
                scope="nft"
                fieldId="mint-asset"
                pageSlug="nft-create"
                purpose="nft-member-mint-asset"
                actionUrl="/nft/create"
              />
              <Button type="submit" disabled={mintPending} className="md:col-span-2">
                {mintPending ? 'Minting...' : 'Mint asset'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle>3. List a mint for RING</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <ActionAlert state={listState} />
          {collectionMints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mint an asset first, then list it here.</p>
          ) : (
            <form action={listAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="collectionId" value={selectedMint?.collectionId || selectedCollectionId} />
              <input type="hidden" name="name" value={selectedMint?.name || ''} />
              <input type="hidden" name="imageUri" value={selectedMint?.imageUri || ''} />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset">Owned mint</Label>
                <select
                  id="asset"
                  name="asset"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {collectionMints.map((m) => (
                    <option key={m.id} value={m.asset}>
                      {m.name || m.asset}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceRing">RING price</Label>
                <Input id="priceRing" name="priceRing" type="number" min="0.01" step="0.01" required placeholder="10" />
              </div>
              <Button type="submit" disabled={listPending} className="self-end">
                {listPending ? 'Listing...' : 'List on market'}
              </Button>
              {listState?.listingId ? (
                <Button asChild variant="outline" className="md:col-span-2">
                  <Link href={ROUTES.NFT_MARKET_LISTING(listState.listingId, locale)}>View listing</Link>
                </Button>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>

      {collections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your collections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="font-medium">
                    {c.name} <span className="text-muted-foreground">· {c.symbol}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.mintCount}/{c.maxMints} minted · {c.mode}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={ROUTES.NFT_CREATE_COLLECTION(c.id, locale)}>Manage</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
