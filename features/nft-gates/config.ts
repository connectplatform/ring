/**
 * NFT gate config accessors — ring-config install defaults + db() active-template overlay
 */

import { cache } from 'react'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { NftGateConfig, NftGateSlug, NftGateTemplate } from '@/lib/ring-config-types'

export const getNftGateConfig = cache((): NftGateConfig => {
  const snap = getSystemConfigSnapshot() as { nft?: NftGateConfig }
  return snap.nft ?? { enabled: false, templates: [] }
})

export function isNftGatesEnabled(): boolean {
  const cfg = getNftGateConfig()
  return Boolean(cfg.enabled)
}

/** Install defaults from ring-config (no DB overlay). */
export function listNftGateTemplates(): NftGateTemplate[] {
  return getNftGateConfig().templates ?? []
}

export function getNftGateTemplate(slug: NftGateSlug | string): NftGateTemplate | null {
  return listNftGateTemplates().find((t) => t.slug === slug) ?? null
}

/**
 * Templates with activeTemplateAsset / imageUri merged from db() nft_gates pointers.
 * Prefer this on admin + public gate listing surfaces.
 */
export async function listNftGateTemplatesResolved(): Promise<NftGateTemplate[]> {
  const base = listNftGateTemplates()
  try {
    const { loadActiveTemplateOverlay } = await import('./active-template-store')
    const overlay = await loadActiveTemplateOverlay()
    return base.map((tpl) => {
      const hit = overlay[tpl.slug]
      if (!hit) return tpl
      return {
        ...tpl,
        activeTemplateAsset: hit.activeTemplateAsset,
        ...(hit.imageUri ? { imageUri: hit.imageUri } : {}),
      }
    })
  } catch {
    return base
  }
}

export async function getNftGateTemplateResolved(
  slug: NftGateSlug | string,
): Promise<NftGateTemplate | null> {
  const list = await listNftGateTemplatesResolved()
  return list.find((t) => t.slug === slug) ?? null
}

export function getNftCollectionMint(): string | undefined {
  const mint = getNftGateConfig().collectionMint?.trim()
  return mint || undefined
}

/** Off-chain collection metadata JSON URI (Explorer Symbol source). */
export function getNftCollectionUri(): string {
  const uri = getNftGateConfig().collectionUri?.trim()
  return uri || 'https://ring-platform.org/nft/gates/collection.json'
}

/** NFT collection ticker intent (KEYS) — not RING payment token. */
export function getNftCollectionSymbol(): string {
  const symbol = getNftGateConfig().collectionSymbol?.trim()
  return symbol || 'KEYS'
}

/** Default Metaplex Core collection display name (≤32 chars on-chain). */
export function getNftCollectionName(): string {
  return 'Ringdom Keys Collection'
}

export function getGateEscrowProgramId(): string | undefined {
  const id = getNftGateConfig().gateEscrowProgramId?.trim()
  return id || undefined
}

export function isNftMarketplaceEnabled(): boolean {
  const cfg = getNftGateConfig()
  return Boolean(cfg.enabled && cfg.marketplaceEnabled)
}

export function getGateMarketProgramId(): string | undefined {
  const id = getNftGateConfig().gateMarketProgramId?.trim()
  return id || undefined
}

export function getMarketplaceFeeRecipient(): string | undefined {
  const recipient = getNftGateConfig().marketplaceFeeRecipient?.trim()
  return recipient || undefined
}

export function getMarketplaceFeeBps(): number {
  const raw = getNftGateConfig().marketplaceFeeBps
  if (!Number.isFinite(raw) || raw == null) return 0
  return Math.max(0, Math.min(10_000, Math.floor(raw)))
}

export function isSponsorFeePayerEnabled(): boolean {
  return getNftGateConfig().sponsorFeePayer !== false
}

/** Member creator lane (on-platform collections + mint/list PoC). */
export function isMemberCollectionsEnabled(): boolean {
  const cfg = getNftGateConfig()
  return Boolean(cfg.enabled && cfg.marketplaceEnabled && cfg.memberCollectionsEnabled)
}

export function getMaxCollectionsPerMember(): number {
  const raw = getNftGateConfig().maxCollectionsPerMember
  if (!Number.isFinite(raw) || raw == null || raw < 1) return 3
  return Math.min(50, Math.floor(raw))
}

export function getMaxMintsPerCollection(): number {
  const raw = getNftGateConfig().maxMintsPerCollection
  if (!Number.isFinite(raw) || raw == null || raw < 1) return 50
  return Math.min(500, Math.floor(raw))
}
