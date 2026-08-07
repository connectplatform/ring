/**
 * Subscription provider stubs — WayForPay / Stripe / nft_gate / paypal promoted to own files.
 * This module only re-exports nft_gate for backward imports.
 */

import 'server-only'

/** Re-export Phase S7 NFT gate provider (Metaplex Core + GateEscrow). */
export { nftGateSubscriptionProvider } from './nft-gate-subscription'

/** @deprecated Import from paypal-subscription.ts */
export { paypalSubscriptionProvider } from './paypal-subscription'
