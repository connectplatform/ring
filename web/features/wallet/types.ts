/**
 * Wallet types — Barreled exports from centralized SSOT (Single Source of Truth).
 *
 * New code should import from `@/features/wallet/types` directly.
 * This file exists for backward compatibility.
 */

// Exporting wallet type definitions from the core SSOT. Consumers should migrate to new import paths.
// TODO: Codemod legacy imports to direct `@/features/wallet/types` to improve tree-shaking and future maintainability.
export type {
  Wallet,
  WalletChain,
  WalletAccount,
  WalletInfo,
  GeneratedChainWallet,
  ChainWalletAdapter,
  WalletContact,
  EnsureWalletResult,
} from '@/features/wallet/types/wallet'

// Exporting transaction types from the transaction SSOT.
// TODO: Adapt consumers to import directly from `@/features/wallet/types/transaction`.
export type {
  WalletTransactionKind,
  WalletTransactionExcerpt,
  WalletTransactionDetails,
} from '@/features/wallet/types/transaction'

// Exporting wallet activity related types.
// TODO: Refactor all imports to use direct `@/features/wallet/types/activity` for improved clarity.
export type {
  WalletActivitySource,
  WalletActivityRow,
} from '@/features/wallet/types/activity'
