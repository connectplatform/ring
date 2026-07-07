/**
 * Wallet types — Centralized SSOT for wallet-related interfaces.
 * 
 * Single Source of Truth (SSOT) for wallet domain types.
 * SSOT hierarchy:
 *   1. Wallet interface → features/auth/types.ts (shared across auth + wallet)
 *   2. Wallet balances, adapter, contacts → here
 *   3. WalletInfo (API-facing list item) → here
 *   4. GeneratedChainWallet + ChainWalletAdapter → here (moved from chains/types.ts)
 *   5. UserOverride + EnsureWalletResult → here (moved from ensure-wallet.ts)
 *
 * Changelog 2026-07-03:
 *   - WalletChain widened from NativeChain to EnabledChains
 *   - DEFAULT_WALLET_CHAIN added — single source of truth for legacy chainless
 *     wallet rows (pre-Solana EVM wallets predate the chain field)
 */

import type { NativeChain, EnabledChains } from '@/lib/ring-config-chain' // Import chain types for extensible chain support
import type { Wallet } from '@/features/auth/types' // Canonical core wallet type imported from auth
import type { UserRolesArray } from '@/features/auth/user-role' // User role array for permissions

// Re-export the canonical Wallet type to ensure a single source of truth across modules
export type { Wallet }

// ---------------------------------------------------------------------------
// Chain identity (widened — was NativeChain, now EnabledChains)
// ---------------------------------------------------------------------------

/**
 * The set of chains a user can hold a wallet for.
 * Uses EnabledChains so project can expand chains without changing this type.
 */
export type WalletChain = EnabledChains

/**
 * Legacy chainless wallets fallback — 'evm' is chosen as pre-Solana was always EVM.
 * This constant replaces scattered default chain usage for improved maintainability.
 */
export const DEFAULT_WALLET_CHAIN: WalletChain = 'evm' as WalletChain

/** Re-export for clarity: NativeChain is an alias for 'solana' in ring-platform.org */
export type { NativeChain }

/**
 * Representation of a user's wallet account/account slot.
 * - address: Wallet's public key/address.
 * - primary?: If this is the user's primary account.
 * - label?: Optional UI/user label.
 * - createdAt?: Optional creation timestamp (ISO-8601).
 */
export interface WalletAccount {
  address: string
  primary?: boolean
  label?: string
  createdAt?: string
}

/**
 * API-facing wallet list item.
 * Used by list-wallets.ts & wallet-list-provider. Fields allow:
 * - Address, primary status, user-supplied label & creation details.
 * - balance & nativeBalance: formatted string representations, if available.
 * - tokenSymbol: the token symbol of the balance, if present.
 * - creditFiatCurrency: fiat currency (if wallet supports fiat overlay).
 * - chain?: Strongly typed chain ('solana' | 'evm') for frontend differentiation.
 * // TODO: If additional chains are enabled dynamically, migrate 'chain' to WalletChain for type consistency.
 */
export interface WalletInfo {
  address: string
  isPrimary: boolean
  label?: string
  createdAt?: string
  balance?: string
  nativeBalance?: string
  tokenSymbol?: string
  creditFiatCurrency?: string
  chain?: 'solana' | 'evm' // TODO: Extend this union from WalletChain for expanded chain support in future.
}

// ---------------------------------------------------------------------------
// Wallet adapters (chain-specific wallet generation)
// ---------------------------------------------------------------------------

/**
 * Represents a generated wallet for a specific chain.
 * - chain: Which chain this wallet is for.
 * - address: Wallet address/public key.
 * - secret: Private key/secret (used on creation, never returned elsewhere).
 * - label: Human-friendly label for identification/use in UI.
 */
export interface GeneratedChainWallet {
  chain: NativeChain
  address: string
  secret: string
  label: string
}

/**
 * Adapter interface for plugging in support for other chain wallet creation.
 * - chain: Which chain this adapter generates wallets for.
 * - label: Human label for the adapter (UI/display).
 * - getChainLabel(): Gets a user-facing string for the chain (for UI menus, etc).
 * - getTokenSymbol?(): Optionally returns native token symbol. 
 *   // TODO: Make required when all adapters implement. Move to required once legacy logic is refactored.
 * - generate(): Async method to generate & return a new chain wallet.
 * 
 * // STUB: When adding new chains:
 * //   1. Implement this interface for each new chain.
 * //   2. Validate token symbol and chain label logic in ensure-wallet.ts.
 */
export interface ChainWalletAdapter {
  chain: NativeChain
  label: string
  getChainLabel(): string
  /**
   * Optional: token symbol for the chain's native token.
   * TODO: Make required once all adapters implement it. Used to populate
   * Wallet.symbol in ensure-wallet.ts (was previously hardcoded to chain name,
   * which collided with token symbol semantics).
   */
  getTokenSymbol?(): string
  generate(): Promise<GeneratedChainWallet>
}

// ---------------------------------------------------------------------------
// Wallet contact types
// ---------------------------------------------------------------------------

/**
 * Represents contacts/addressbook for a wallet.
 * - id: Stable unique id for the contact.
 * - name: Human-friendly display name.
 * - address: Public key/main address for this contact.
 * - notes: Optional memo for user.
 * - isFavorite: Boolean for featured/favorite contacts.
 * - isDefault: Boolean for system default contacts.
 * - addedAt: Timestamp (ISO-8601) when contact was added.
 * - lastUsed: Timestamp (ISO-8601) when last transacted.
 */
export interface WalletContact {
  id: string
  name: string
  address: string
  notes?: string
  isFavorite?: boolean
  isDefault?: boolean
  addedAt: string
  lastUsed?: string
}

// ---------------------------------------------------------------------------
// Wallet ensure result + user override (moved from ensure-wallet.ts)
// ---------------------------------------------------------------------------

/**
 * Result returned from ensureWallets() API/service.
 * - native: The "native" wallet for the user's main chain (single source of truth).
 * - wallets: All wallets for the user, including non-native chains.
 * // Usage: Benefit for page/static usage and Next16 streaming transitions. 
 * // TODO: If ensuring wallets server-side (Next.js route handlers or React Server Components), 
 * //   consider using useOptimistic or server actions in React 19 & Next16 for atomicity.
 */
export interface EnsureWalletResult {
  native: Wallet
  wallets: Wallet[]
}

/**
 * Override used by admin/system flows to call ensureWallets() without
 * relying on the request session.
 * - id: User's unique id.
 * - role: Array of role names (guarded via validated enum — never raw strings).
 *   Typing ensures only known roles are passed (safety for RBAC).
 * // TODO: When RBAC surface increases, use union types and utility types from React/TypeScript for improved granularity.
 */
export interface UserOverride {
  id: string
  role: UserRolesArray
}
