/**
 * @deprecated Use `usePrimaryNativeBalance` from `@/hooks/use-primary-native-balance`.
 *
 * There is no `useNativeTokenBalance` React hook. Naming map:
 * - Client SSOT: `usePrimaryNativeBalance` — custodial primary wallet via GET /api/wallet/list
 * - Server on-chain: `getNativeTokenBalance` / `getNativeTokenBalanceForUser`
 * - Server action: `getNativeTokenBalanceAction`
 *
 * Legacy wagmi multi-token (RING/POL/USDT/USDC) hook was retired; this file keeps a
 * deprecated alias so residual imports resolve to the custodial native SSOT.
 */

export {
  usePrimaryNativeBalance,
  usePrimaryNativeBalance as useTokenBalance,
  type UsePrimaryNativeBalanceOptions,
  type PrimaryNativeBalanceState,
} from './use-primary-native-balance'
