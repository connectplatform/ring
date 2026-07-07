// TODO: this file serves legacy logic of Ring and must be updgraded to new SSOT (Single Source of Truth).
// TODO: Consider using App Router or server actions for next-gen data/configuration handling (Next.js 13+/16).
// TODO: Move sensitive config/env logic to server-only modules for improved security in Next.js 13+/16.
// TODO: Consider using React context/provider for propagating web3 constants globally if used on client components.

/**
 * Web3 Constants for Ring Platform
 * Defines blockchain addresses, network configurations, and token details.
 * 
 * Modern Next.js and React SSR/SSG/ISR best practices suggested where applicable.
 */

import { getPolygonRpcUrl } from '@/lib/web3/polygon-rpc'

// --- Network Configuration ---

// Polygon mainnet chain ID (EVM)
export const POLYGON_CHAIN_ID = 137

// RPC URL for Polygon (via custom function for per-env switching)
export const POLYGON_RPC_URL = getPolygonRpcUrl()

// Polygonscan API details (for explorer links and API queries)
export const POLYGONSCAN_API_URL = 'https://api.polygonscan.com/api'
// TODO: Migrate to server-only usage for security, e.g. export from /lib/env/server
export const POLYGONSCAN_API_KEY = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || ''


// --- Token Addresses (Polygon Mainnet) ---

// STUB: Replace zero address stubs with actual deployed contract addresses via CI/CD or config fetch.
// TODO: Integrate with vault/config SSOT; do not expose secret values on client.
export const RING_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'
export const RING_STAKING_ADDRESS = process.env.NEXT_PUBLIC_RING_STAKING_ADDRESS || '0x0000000000000000000000000000000000000000'
export const RING_SALES_ADDRESS = process.env.NEXT_PUBLIC_RING_SALES_ADDRESS || '0x0000000000000000000000000000000000000000'

// Referral rewards addresses (STUBS: must be set per environment and deployed contract)
// STUB: Use infra/env detection to auto-detect these and throw on unset in production.
export const REFERRAL_REWARDS_ADDRESS =
  process.env.REFERRAL_REWARDS_ADDRESS || '0x0000000000000000000000000000000000000000'

// If env not provided, fallback to RING token or stub address
export const REFERRAL_REWARD_TOKEN_ADDRESS =
  process.env.REFERRAL_REWARD_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'

// --- Wrapped tokens and stablecoins (Polygon Mainnet) ---

// Hardcoded mainnet well-known address - safe to export
export const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // Wrapped MATIC/POL
export const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon

// --- Token Configurations ---

/**
 * Central token map for lookup by address.
 * NOTE: RING token config is keyed by the (possibly env) address, not always the actual deployed contract yet.
 * TODO: Switch to `Map` for clear performance and semantic keys, or use SSOT when available.
 */
export const TOKEN_CONFIGS: Record<string, { symbol: string; name: string; decimals: number; icon: string }> = {
  [RING_TOKEN_ADDRESS]: {
    symbol: 'RING',
    name: 'Ring Token',
    decimals: 18,
    icon: '/icons/ring-token.svg',
  },
  [WPOL_ADDRESS]: {
    symbol: 'POL',
    name: 'Polygon',
    decimals: 18,
    icon: '/icons/polygon.svg',
  },
  [USDT_ADDRESS]: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    icon: '/icons/usdt.svg',
  },
  [USDC_ADDRESS]: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '/icons/usdc.svg',
  },
  // STUB: Add additional supported token configs as needed.
}

// --- Staking Configuration ---

/**
 * Staking pools indexed by pool id.
 * 
 * NOTE: Only RING staking currently defined; extend for multi-pool/multi-token support.
 * STUB: For multi-stake-pool support, abstract to array/data-driven config.
 */
export const STAKING_POOLS = {
  RING_STAKING: {
    id: 'ring-staking',
    name: 'RING Staking',
    tokenAddress: RING_TOKEN_ADDRESS,
    stakingAddress: RING_STAKING_ADDRESS,
    apr: 20, // 20% APR
    lockPeriod: 0, // No lock period (in seconds, for future extensibility)
    minStake: '100', // Minimum 100 RING as string for precision
    // STUB: Add future fields (reward token, early withdrawal penalty, etc.)
  },
}

// --- Transaction Settings ---

/**
 * Transaction settings for gas management etc.
 * TODO: Make per-network or user-adjustable for advanced logic.
 */
export const DEFAULT_GAS_LIMIT = 300000
export const DEFAULT_SLIPPAGE_TOLERANCE = 2 // 2%
export const TRANSACTION_TIMEOUT = 60000 // 60 seconds

// --- Block Explorer & Utility Functions ---

/**
 * Get a block explorer url for a transaction hash (Polygon).
 * Usage: open transaction results directly.
 * @param txHash 
 * @returns 
 */
export const getPolygonscanUrl = (txHash: string): string =>
  `https://polygonscan.com/tx/${txHash}`

/**
 * Gets the display symbol for the referral reward token
 * - Returns 'RING' if referral reward token address is unset or zero address
 * - Otherwise, attempts to resolve symbol from TOKEN_CONFIGS
 * - Fallbacks to 'TOKEN' if not found
 */
export function getReferralRewardTokenSymbol(): string {
  const addr = (REFERRAL_REWARD_TOKEN_ADDRESS || '').toLowerCase();
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    return 'RING'
  }
  const entry = Object.entries(TOKEN_CONFIGS).find(
    ([tokenAddr]) => tokenAddr.toLowerCase() === addr
  )
  return entry?.[1]?.symbol ?? 'TOKEN'
}

/**
 * Get a block explorer url for an address (Polygon)
 * @param address 
 * @returns 
 */
export const getPolygonscanAddressUrl = (address: string): string =>
  `https://polygonscan.com/address/${address}`

/**
 * Validates an EVM address for basic structure.
 * - Must start with 0x and be 42 chars total, containing only hex digits.
 * - Returns false for non-string/invalid input.
 * 
 * TODO: Consider using ethers.js Address utils for stricter validation.
 */
export const isValidAddress = (address: string): boolean => {
  if (typeof address !== 'string') return false
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Retrieves the token config object given an address.
 * @param address 
 * @returns token config or null if not configured
 */
export const getTokenConfig = (address: string) => {
  // Normalize to lowercase for case insensitive match
  const normalizedAddress = address.toLowerCase()
  const config = Object.entries(TOKEN_CONFIGS).find(
    ([addr]) => addr.toLowerCase() === normalizedAddress
  )
  return config ? config[1] : null
}

// --- Supported Tokens List ---

/**
 * List of supported token addresses for easy iteration.
 * Filters out stubbed zero addresses (i.e. not yet configured).
 * TODO: Dynamically build from TOKEN_CONFIGS keys if multi-token expansion required.
 */
export const SUPPORTED_TOKENS = [
  RING_TOKEN_ADDRESS,
  WPOL_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
].filter(addr => addr !== '0x0000000000000000000000000000000000000000')
