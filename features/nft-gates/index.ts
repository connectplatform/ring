/**
 * NFT Gates feature barrel — Metaplex Core + GateEscrow (not NATIVE_NFT_APR).
 */

export * from './types'
export * from './config'
export { mintGateAsset, verifyAssetInCollection, assertGateCollectionReady } from './metaplex-core'
export {
  deriveGateEscrowPda,
  listActiveStakes,
  stakeGateAsset,
  unstakeGateAsset,
  invalidateEntitlementsForAsset,
  listEntitlementCache,
} from './gate-escrow'
export { hasFeature, hasFeatureForVendor, listUnlockedFeatures } from './gate-resolver'
export { listOwnedGateAssets, purchaseGateNft } from './purchase'
export {
  upsertActiveTemplatePointer,
  getActiveTemplatePointer,
  loadActiveTemplateOverlay,
} from './active-template-store'
export {
  persistPaymentConfirmed,
  refundAfterMintFailure,
  markMintSucceeded,
  findPurchaseByPaySignature,
} from './pay-mint-refund'
export { adminActivateTemplateAsset, adminCreateGateCollection, adminUpdateGateCollectionMetadata } from './admin-mint'
