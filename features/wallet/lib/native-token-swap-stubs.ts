/**
 * Native-token treasury swap — client-safe allowlist + eligibility helpers.
 *
 * Server execute/quote: features/wallet/services/treasury-swap-service.ts
 * Config SSOT: ring-config.json → chains.evm.treasurySwapAllowlist
 */

import { getClientTreasurySwapAllowlist } from '@/lib/ring-config-client'

export type NativeTokenSwapAllowlistEntry = {
  /** ERC-20 contract address (checksummed). */
  tokenAddress: `0x${string}`
  symbol: string
  decimals: number
  /** When true, show "Swap for {nativeSymbol}" on the sign-in wallet row. */
  enabled: boolean
  chainlinkFeed?: string
}

/** Read enabled allowlist from ring-config (bundled client snapshot). */
export function getNativeTokenSwapAllowlist(): NativeTokenSwapAllowlistEntry[] {
  return getClientTreasurySwapAllowlist().map((e) => ({
    tokenAddress: e.tokenAddress,
    symbol: e.symbol,
    decimals: e.decimals,
    enabled: e.enabled,
    chainlinkFeed: e.chainlinkFeed,
  }))
}

export type SignInWalletSwapAsset = {
  tokenAddress: `0x${string}` | 'native'
  symbol: string
  balance: string
  decimals: number
  /** True when this asset is on the treasury swap allowlist (or is gas native). */
  swapListed: boolean
}

/** True when any allowlisted token has a positive balance on the sign-in wallet. */
export function hasSwapEligibleAssets(assets: SignInWalletSwapAsset[]): boolean {
  return assets.some(
    (a) => a.swapListed && Number.parseFloat(a.balance) > 0,
  )
}

/** @deprecated Server-only — use /api/wallet/treasury-swap/* */
export async function stubSwapSignInTokenForNative(_params: {
  userId: string
  fromTokenAddress: `0x${string}`
  amount: string
}): Promise<{ success: false; error: string }> {
  return { success: false, error: 'use_treasury_swap_api' }
}

/** @deprecated Server-only — use executeTreasuryDiversify via admin API */
export async function stubTreasuryDiversify(_params: {
  adminUserId: string
}): Promise<{ success: false; error: string }> {
  return { success: false, error: 'use_treasury_diversify_api' }
}
