/**
 * Web3 Constants for Ring Platform
 * Defines blockchain addresses, network configurations, and token details
 */

// Network Configuration
export const POLYGON_CHAIN_ID = 137
export const POLYGON_RPC_URL = 'https://polygon-rpc.com'
export const POLYGONSCAN_API_URL = 'https://api.polygonscan.com/api'
export const POLYGONSCAN_API_KEY = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || ''

// Token Addresses (Polygon Mainnet)
// TODO: Replace with actual deployed RING token addresses
export const RING_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'
export const RING_STAKING_ADDRESS = process.env.NEXT_PUBLIC_RING_STAKING_ADDRESS || '0x0000000000000000000000000000000000000000'
export const RING_SALES_ADDRESS = process.env.NEXT_PUBLIC_RING_SALES_ADDRESS || '0x0000000000000000000000000000000000000000'

// Wrapped tokens and stablecoins (Polygon Mainnet)
export const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // Wrapped MATIC/POL
export const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon

// Token Configurations
export const TOKEN_CONFIGS = {
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
}

// Staking Configuration
export const STAKING_POOLS = {
  RING_STAKING: {
    id: 'ring-staking',
    name: 'RING Staking',
    tokenAddress: RING_TOKEN_ADDRESS,
    stakingAddress: RING_STAKING_ADDRESS,
    apr: 20, // 20% APR
    lockPeriod: 0, // No lock period
    minStake: '100', // Minimum 100 RING
  },
}

// Transaction Settings
export const DEFAULT_GAS_LIMIT = 300000
export const DEFAULT_SLIPPAGE_TOLERANCE = 2 // 2%
export const TRANSACTION_TIMEOUT = 60000 // 60 seconds

// Block Explorer URLs
export const getPolygonscanUrl = (txHash: string) => 
  `https://polygonscan.com/tx/${txHash}`

export const getPolygonscanAddressUrl = (address: string) => 
  `https://polygonscan.com/address/${address}`

// Helper function to validate addresses
export const isValidAddress = (address: string): boolean => {
  try {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  } catch {
    return false
  }
}

// Helper function to get token config
export const getTokenConfig = (address: string) => {
  const normalizedAddress = address.toLowerCase()
  const config = Object.entries(TOKEN_CONFIGS).find(
    ([addr]) => addr.toLowerCase() === normalizedAddress
  )
  return config ? config[1] : null
}

// Export all addresses as a list for easy iteration
export const SUPPORTED_TOKENS = [
  RING_TOKEN_ADDRESS,
  WPOL_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
].filter(addr => addr !== '0x0000000000000000000000000000000000000000')
