// TODO: add zod to transaction-kind types 
/**
 * Centralized Single Source Of Truth (SSOT) for wallet transaction-related interfaces.
 *
 * This file defines the core transaction types shared across services:
 * - The enum for transaction kinds (add only here!)
 * - The transaction "excerpt" type for transaction list view (WalletTransactionExcerpt)
 * - The detailed transaction type for drilldown/details screens (WalletTransactionDetails)
 * 
 * Individual services are encouraged to extend these types, not duplicate them.
 */

// ---------------------------------------------------------------------------
// Transaction Kind Enum
// ---------------------------------------------------------------------------

/**
 * Explicit transaction kinds for all wallet operations.
 * Add new kinds here to preserve strong typing and auto-completion.
 * The string fallback ensures forward compatibility for unforeseen kinds,
 * but should be avoided in favor of explicit values when possible.
 * 
 * TODO: Consider replacing untyped string fallback in favor of a more robust enum for type safety.
 * If using zod or similar schemas, align schemas with this type.
 */
export type WalletTransactionKind =
  | 'send'                 // Sending tokens to another user/wallet
  | 'receive'              // Receiving tokens from another user/wallet
  | 'stake'                // Staking tokens
  | 'unstake'              // Unstaking tokens
  | 'claim'                // Claiming rewards or airdrops
  | 'buy'                  // Buying tokens/assets
  | 'pin_access_granted'   // Access granted via pin feature
  // Add new transaction kinds above as needed for strong typing

// ---------------------------------------------------------------------------
// WalletTransactionExcerpt: Transaction shape for list overview in UI
// ---------------------------------------------------------------------------

/**
 * Minimal representation of a wallet transaction for fast rendering in transaction lists.
 * Includes only vital keys needed for user transaction list view.
 */
export interface WalletTransactionExcerpt {
  id: string                      // Unique transaction ID (required for UI keys)
  kind: WalletTransactionKind     // Transaction kind (strongly typed)
  timestamp: string               // For UI ordering (should be ISO format)
  amount?: string                 // Transaction amount as string (optional)
  tokenSymbol?: string            // Token symbol (optional, ERC20/etc)
  status: 'success' | 'pending' | 'failed' // Status for UI/status badges
  walletAddress: string           // User's wallet address (for display/context)
  recipient: string               // Recipient info (for display/context)
  // Additional fields as needed for list view (add here if required by design)
}

// ---------------------------------------------------------------------------
// WalletTransactionDetails: Full transaction details as in DB & enriched for details screen
// ---------------------------------------------------------------------------

/**
 * Comprehensive representation of a wallet transaction for details/drilldown screen.
 * Includes the full set of DB and enriched/derived fields.
 * This type should serve for both DB fetches and full UI detail rendering.
 */
export interface WalletTransactionDetails {
  id: string                            // Unique DB identifier
  kind: WalletTransactionKind           // Transaction kind
  userId: string                        // User wallet owner
  txHash?: string                       // Blockchain transaction hash
  fromAddress?: string                  // From wallet address (if relevant)
  toAddress?: string                    // To wallet address (if relevant)
  amount?: string                       // Amount (string for big numbers)
  tokenSymbol?: string                  // ERC20 token symbol, if present
  chain?: string                        // Chain/network identifier
  notes?: string | null                 // Additional notes/comments
  contactUserId?: string | null         // Contact user, for P2P or inter-user txs
  deskOrderId?: string | null           // Reference to desk order ID (if applicable)
  createdAt?: string                    // Creation time (ISO string)
  timestamp: string                     // Normalized timestamp for UI ordering (can be copy of createdAt or on-chain settlement)
  walletAddress: string                 // User's main wallet address (used for UI)
  recipient: string                     // Recipient info (normalized for UI)
  status: 'success' | 'pending' | 'failed' // Status (derived)
  networkId: number                     // Chain/network ID (EVM chains)
  blockNumber?: number                  // On-chain block number, if confirmed
  gasUsed?: string                      // EVM gas used (if applicable)
  gasPrice?: string                     // EVM gas price (if applicable)
  from?: string                         // Raw 'from' on-chain address (if any)
  to?: string                           // Raw 'to' on-chain address (if any)
  value?: string                        // Raw transaction value (in wei, for EVM)
  metadata?: Record<string, unknown>    // Arbitrary extra info for feature extensibility
  // If more detail fields are needed add here (for "ShowTransactionDetails" screen)
  // NOTE: This type acts as full DB + enriched/denormalized field shape
}
