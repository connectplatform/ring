// /**
// DEPRECATED, UPGRADE REFERRING LOGIC
//  * Legacy wallet types — preserved for backward compatibility.
//  *
//  * Originally in features/wallet/types.ts.  These are still used by some
//  * components but should be migrated to the new centralized types over time.
//  */

// /** Multi-token balance map (token symbol → balance string) */
// export interface WalletBalances {
//   RING?: string
//   POL?: string
//   USDT?: string
//   USDC?: string
//   [key: string]: string | undefined
// }

// /** Individual token balance (used by token cards/lists) */
// export interface TokenBalance {
//   symbol: string
//   name: string
//   balance: string
//   decimals: number
//   usdValue?: string
//   tokenAddress?: string
// }

// /** Staking position (used by staking widgets) */
// export interface StakingPosition {
//   poolId: string
//   poolName: string
//   stakedAmount: string
//   pendingRewards: string
//   apr: number
//   tokenSymbol: string
//   rewardSymbol: string
//   lastClaimTime?: number
//   lockEndTime?: number
// }

// /** Abstract wallet adapter (UI-level — differs from ChainWalletAdapter) */
// export interface WalletAdapter {
//   getPrimaryAccount(): Promise<WalletAccount | null>
//   getBalances(address: string): Promise<WalletBalances>
//   getTokenBalances?(address: string): Promise<TokenBalance[]>
//   getTransactionHistory?(address: string, limit?: number): Promise<WalletTransaction[]>
//   sendTransaction?(params: {
//     from: string
//     to: string
//     amount: string
//     tokenAddress?: string
//     data?: string
//   }): Promise<string>
//   getStakingPositions?(address: string): Promise<StakingPosition[]>
// }

// import type { WalletAccount } from './wallet'
// import type { WalletTransaction } from './transaction'
