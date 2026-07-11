'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import {
  adminActivateGateTemplateAction,
  adminCreateGateCollectionAction,
  adminUpdateGateCollectionMetadataAction,
} from '@/app/_actions/nft-gates'
import { GateArtPreviewModal } from '@/features/admin/nft/gate-art-preview-modal'
import type { NftGateTemplate } from '@/lib/ring-config-types'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

interface AdminNftTemplatesClientProps {
  locale: Locale
  templates: NftGateTemplate[]
  collectionMint?: string
  collectionUri?: string
  collectionSymbol?: string
  tokenSymbol: string
}

export function AdminNftTemplatesClient({
  locale,
  templates,
  collectionMint,
  collectionUri = 'https://ring-platform.org/nft/gates/collection.json',
  collectionSymbol = 'KEYS',
  tokenSymbol,
}: AdminNftTemplatesClientProps) {
  const [pending, startTransition] = useTransition()
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(templates.map((t) => [t.slug, String(t.priceRing)])),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<NftGateTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  function openArtPreview(template: NftGateTemplate) {
    setError(null)
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  function activateWithoutArt(slug: NftGateTemplate['slug']) {
    setError(null)
    setMessage(null)
    setBusySlug(slug)
    const priceRing = Number(prices[slug])
    startTransition(async () => {
      const result = await adminActivateGateTemplateAction({
        slug,
        priceRing: Number.isFinite(priceRing) ? priceRing : undefined,
        regenerateArt: false,
      })
      if (!result.success) {
        setError(result.error || 'Activation failed')
      } else {
        setMessage(
          `Activated ${slug} → ${result.activeTemplateAsset}${result.imageUri ? ` · art ${result.imageUri}` : ''}`,
        )
      }
      setBusySlug(null)
    })
  }

  function createCollection() {
    setError(null)
    setMessage(null)
    setBusySlug('__collection__')
    startTransition(async () => {
      const result = await adminCreateGateCollectionAction({
        name: 'Ringdom Keys Collection',
        uri: collectionUri,
      })
      if (!result.success) {
        setError(result.error || 'createCollection failed')
      } else {
        setMessage(
          `KEYS collection created: ${result.collectionMint}. Set nft.collectionMint in ring-config (Squads authority before mainnet). Tx: ${result.signature}`,
        )
      }
      setBusySlug(null)
    })
  }

  function updateCollectionMetadata() {
    setError(null)
    setMessage(null)
    setBusySlug('__collection_meta__')
    startTransition(async () => {
      const result = await adminUpdateGateCollectionMetadataAction({
        name: 'Ringdom Keys Collection',
        uri: collectionUri,
        collectionMint,
      })
      if (!result.success) {
        setError(result.error || 'updateCollection failed')
      } else {
        setMessage(
          `KEYS metadata linked on-chain → ${result.uri} (symbol ${collectionSymbol}). Tx: ${result.signature}. Explorer may lag while DAS indexes.`,
        )
      }
      setBusySlug(null)
    })
  }

  return (
    <div className="space-y-6">
      <GateArtPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        template={previewTemplate}
        priceRing={
          previewTemplate
            ? Number(prices[previewTemplate.slug]) || previewTemplate.priceRing
            : undefined
        }
        onMinted={(result) => {
          setMessage(
            `Activated ${result.slug} → ${result.activeTemplateAsset}${result.imageUri ? ` · art ${result.imageUri}` : ''}`,
          )
        }}
      />

      <div className="rounded-lg border p-4 text-sm space-y-2">
        <p>
          <span className="font-medium">Collection mint:</span>{' '}
          {collectionMint || (
            <span className="text-amber-700 dark:text-amber-400">
              unset — ledger-dev mint (local only; create collection then set nft.collectionMint)
            </span>
          )}
        </p>
        <p>
          <span className="font-medium">Family:</span>{' '}
          <Badge variant="secondary">{collectionSymbol}</Badge>
          <span className="text-muted-foreground"> · Ringdom Keys Collection</span>
        </p>
        <p className="break-all text-muted-foreground">
          Metadata URI: {collectionUri} (Explorer <strong>Symbol</strong> = {collectionSymbol} from
          JSON — not the {tokenSymbol} payment token)
        </p>
        <p className="text-muted-foreground">
          Mainnet: migrate update authority to Squads before go-live. Mint SSOT is Metaplex Core
          (`create` + `fetchAsset`). Price change mints a new active template asset — sold assets are
          never mutated.
        </p>
        <div className="flex flex-wrap gap-2">
          {!collectionMint && (
            <Button
              size="sm"
              disabled={pending && busySlug === '__collection__'}
              onClick={createCollection}
            >
              {pending && busySlug === '__collection__' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create KEYS collection
            </Button>
          )}
          {collectionMint && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending && busySlug === '__collection_meta__'}
              onClick={updateCollectionMetadata}
            >
              {pending && busySlug === '__collection_meta__' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Point collection URI → KEYS JSON
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.ADMIN_NFT_MINT(locale)}>Open mint console</Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription className="break-all">{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {templates.map((template) => {
          const busy = pending && busySlug === template.slug
          return (
            <div key={template.slug} className="rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{template.name}</h2>
                <Badge variant="outline">{template.slug}</Badge>
                {template.soulbound ? (
                  <Badge variant="secondary">Soulbound</Badge>
                ) : (
                  <Badge variant="outline">Tradeable</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`price-${template.slug}`}>Price ({tokenSymbol})</Label>
                  <Input
                    id={`price-${template.slug}`}
                    value={prices[template.slug] ?? ''}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [template.slug]: e.target.value }))
                    }
                    className="w-32"
                  />
                </div>
                <Button disabled={busy} onClick={() => openArtPreview(template)}>
                  Mint / activate + art
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => activateWithoutArt(template.slug)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Activate without art regen
                </Button>
              </div>
              {template.activeTemplateAsset && (
                <p className="font-mono text-xs text-muted-foreground break-all">
                  Active template asset (DB): {template.activeTemplateAsset}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
