/**
 * Primary-sale ownership + buy-with-RING (transferChecked via native-token-transfer).
 * On mint failure after payment: treasury→user RING refund (idempotent by purchaseId/paySignature).
 */

import 'server-only'

import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { getNativeTokenTreasuryAddress, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { transferNativeTokenForUser } from '@/features/wallet/chains/native-token-transfer-service'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { UserRolesArray } from '@/features/auth/user-role'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { getNftCollectionMint, getNftGateTemplate, isNftGatesEnabled } from './config'
import { assertGateCollectionReady, mintGateAsset } from './metaplex-core'
import { stakeGateAsset } from './gate-escrow'
import {
  markMintSucceeded,
  persistPaymentConfirmed,
  refundAfterMintFailure,
} from './pay-mint-refund'
import { MEMBERSHIP_GATE_SLUGS, type NftGateSlug, type NftOwnershipRecord } from './types'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'

function nowIso() {
  return new Date().toISOString()
}

export async function listOwnedGateAssets(userId: string): Promise<NftOwnershipRecord[]> {
  const result = await db().queryDocs<NftOwnershipRecord & Record<string, unknown>>({
    collection: 'nft_ownership',
    filters: [{ field: 'userId', operator: '==', value: userId }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })
  if (!result.success || !result.data) return []
  return (result.data as NftOwnershipRecord[]).filter((o) => !o.burnedAt)
}

export async function purchaseGateNft(params: {
  userId: string
  slug: NftGateSlug
  autoStakeMembership?: boolean
  /** Prefer session role so WalletConductor.ensureNativeWallet does not demote admins. */
  userRole?: UserRolesArray
}): Promise<{
  success: boolean
  ownership?: NftOwnershipRecord
  error?: string
  paySignature?: string
  refundSignature?: string
  purchaseId?: string
}> {
  if (!isNftGatesEnabled()) {
    return { success: false, error: 'NFT gates are disabled in ring-config' }
  }

  const template = getNftGateTemplate(params.slug)
  if (!template) return { success: false, error: 'Unknown gate template' }

  // Fail before RING debit if on-chain collection is configured but unreachable
  const collectionReady = await assertGateCollectionReady()
  if (!collectionReady.ok) {
    return {
      success: false,
      error: collectionReady.error || 'NFT collection not ready on Solana RPC',
    }
  }

  const ensured = await WalletConductor.ensureNativeWallet({
    id: params.userId,
    role: params.userRole ?? UserRolesArray.subscriber,
  })
  const wallet = ensured.native
  if (!ensured.ok || !wallet?.address) {
    return { success: false, error: ensured.error || 'Custodial Solana wallet required' }
  }

  const treasury = getNativeTokenTreasuryAddress()
  if (!treasury || treasury === 'RING') {
    return { success: false, error: 'Native token treasury not configured' }
  }

  const decimals = getNativeTokenDecimals() ?? 8
  const rawAmount = nativeTokenUiToRaw(String(template.priceRing), decimals)
  const purchaseId = `purchase_${randomUUID()}`

  let paySignature: string | undefined
  try {
    const pay = await transferNativeTokenForUser({
      userId: params.userId,
      toAddress: treasury,
      amount: rawAmount.toString(),
    })
    paySignature = pay.txHash
  } catch (error) {
    logger.error('Gate purchase: RING transferChecked failed', { error, slug: params.slug })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'RING payment failed',
      purchaseId,
    }
  }

  try {
    await persistPaymentConfirmed({
      purchaseId,
      userId: params.userId,
      slug: params.slug,
      userWallet: wallet.address,
      treasury,
      rawAmount: rawAmount.toString(),
      decimals,
      priceRing: template.priceRing,
      paySignature,
    })
  } catch (persistError) {
    logger.error('Gate purchase: failed to persist payment_confirmed (ops: manual reconcile)', {
      purchaseId,
      paySignature,
      error: persistError,
    })
  }

  let imageUri = `https://ring-platform.org/nft/gates/${params.slug}.png`
  try {
    const art = await ImageConductor.generate({
      purpose: `nft-gate-${params.slug}`,
      prompt: template.imagePrompt,
      actorId: params.userId,
    })
    if (art.success && art.images?.[0]?.url) {
      imageUri = art.images[0].url
    }
  } catch (artError) {
    logger.warn('Gate purchase: ImageConductor failed, using placeholder URI', { artError })
  }

  const minted = await mintGateAsset({
    template,
    ownerPubkey: wallet.address,
    metadataUri: imageUri,
  })
  if (!minted.success || !minted.asset) {
    const mintError =
      minted.error || 'Mint failed after payment — contact support with signatures'
    logger.error('Gate purchase: mint failed after RING payment — initiating refund', {
      userId: params.userId,
      slug: params.slug,
      purchaseId,
      paySignature,
      error: mintError,
    })

    const refund = await refundAfterMintFailure({
      purchaseId,
      paySignature,
      userWallet: wallet.address,
      rawAmount: rawAmount.toString(),
      mintError,
    })

    if (refund.success && refund.refundSignature) {
      return {
        success: false,
        purchaseId,
        paySignature,
        refundSignature: refund.refundSignature,
        error: `Mint failed after payment; RING refunded. paySignature=${paySignature} refundSignature=${refund.refundSignature}${refund.alreadyRefunded ? ' (idempotent)' : ''}. Detail: ${mintError}`,
      }
    }

    logger.error('Gate purchase: mint failed AND refund failed — ops alert', {
      purchaseId,
      paySignature,
      refundError: refund.error,
      mintError,
    })
    return {
      success: false,
      purchaseId,
      paySignature,
      error: `Mint failed after payment and refund failed. paySignature=${paySignature} refundError=${refund.error || 'unknown'}. Detail: ${mintError}. Contact support immediately.`,
    }
  }

  const ownership: NftOwnershipRecord = {
    id: `own_${randomUUID()}`,
    userId: params.userId,
    asset: minted.asset,
    slug: params.slug,
    collectionMint: getNftCollectionMint(),
    soulbound: template.soulbound,
    purchaseId,
    signature: paySignature,
    priceRing: template.priceRing,
    imageUri,
    createdAt: nowIso(),
  }

  const created = await db().createDoc('nft_ownership', ownership, { id: ownership.id })
  if (!created.success) {
    return {
      success: false,
      error: 'Failed to record ownership',
      purchaseId,
      paySignature,
    }
  }

  await markMintSucceeded({
    purchaseId,
    mintAsset: minted.asset,
    mintSignature: minted.signature,
  }).catch((err) => {
    logger.warn('Gate purchase: markMintSucceeded failed (non-fatal)', { purchaseId, err })
  })

  const autoStake =
    params.autoStakeMembership !== false && MEMBERSHIP_GATE_SLUGS.includes(params.slug)
  if (autoStake || (template.stakeRequired && MEMBERSHIP_GATE_SLUGS.includes(params.slug))) {
    await stakeGateAsset({
      userId: params.userId,
      asset: minted.asset,
      slug: params.slug,
    })
  }

  logger.info('Gate purchase complete', {
    userId: params.userId,
    slug: params.slug,
    asset: minted.asset,
    mode: minted.mode,
    purchaseId,
    paySignature,
  })

  return { success: true, ownership, purchaseId, paySignature }
}
