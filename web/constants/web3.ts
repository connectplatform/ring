/**
 * Web3 helpers — explorers + referral address env.
 * Token addresses / RPC / chainId: use `@/lib/ring-config-chain` (`getEvmRpcUrl`, `getEvmTokenAddress`).
 */

import { getEvmTokenAddress, getEvmRpcUrl, getEvmChainId, getNativeTokenSymbol, getNativeTokenSwapAllowlist } from '@/lib/ring-config-chain'

export const POLYGON_CHAIN_ID = getEvmChainId()
export const POLYGON_RPC_URL = getEvmRpcUrl()

export const POLYGONSCAN_API_URL = 'https://api.polygonscan.com/api'
export const POLYGONSCAN_API_KEY = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || ''

/**
 * RING ERC-20 on the configured EVM chain — NOT the Solana SPL mint.
 * SSOT: getEvmTokenAddress() (env NEXT_PUBLIC_RING_TOKEN_ADDRESS / RING_CONTRACT_ADDRESS / chains.evm.tokenAddress).
 */
export function getRingTokenAddress(): string {
  return getEvmTokenAddress() || '0x0000000000000000000000000000000000000000'
}

/** @deprecated Prefer getRingTokenAddress() — kept for gradual migration. */
export const RING_TOKEN_ADDRESS = getRingTokenAddress()

export const RING_STAKING_ADDRESS =
  process.env.NEXT_PUBLIC_RING_STAKING_ADDRESS || '0x0000000000000000000000000000000000000000'
export const RING_SALES_ADDRESS =
  process.env.NEXT_PUBLIC_RING_SALES_ADDRESS || '0x0000000000000000000000000000000000000000'

export const REFERRAL_REWARDS_ADDRESS =
  process.env.REFERRAL_REWARDS_ADDRESS || '0x0000000000000000000000000000000000000000'

export const REFERRAL_REWARD_TOKEN_ADDRESS =
  process.env.REFERRAL_REWARD_TOKEN_ADDRESS ||
  process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS ||
  getRingTokenAddress()

/** Well-known Polygon tokens — prefer getNativeTokenSwapAllowlist() for treasury swap. */
export const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
export const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'

function buildTokenConfigs(): Record<
  string,
  { symbol: string; name: string; decimals: number; icon: string }
> {
  const ring = getEvmTokenAddress()
  const base: Record<string, { symbol: string; name: string; decimals: number; icon: string }> = {
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
  if (ring) {
    base[ring] = {
      symbol: getNativeTokenSymbol(),
      name: 'Ring Token',
      decimals: 18,
      icon: '/icons/ring-token.svg',
    }
  }
  for (const entry of getNativeTokenSwapAllowlist()) {
    if (!entry.address) continue
    base[entry.address] = {
      symbol: entry.symbol,
      name: entry.symbol,
      decimals: entry.decimals ?? 18,
      icon: `/icons/${entry.symbol.toLowerCase()}.svg`,
    }
  }
  return base
}

export const TOKEN_CONFIGS = buildTokenConfigs()

export const STAKING_POOLS = {
  RING_STAKING: {
    id: 'ring-staking',
    name: 'RING Staking',
    tokenAddress: RING_TOKEN_ADDRESS,
    stakingAddress: RING_STAKING_ADDRESS,
    apr: 20,
    lockPeriod: 0,
    minStake: '100',
  },
}

export const DEFAULT_GAS_LIMIT = 300000
export const DEFAULT_SLIPPAGE_TOLERANCE = 2
export const TRANSACTION_TIMEOUT = 60000

export const getPolygonscanUrl = (txHash: string): string =>
  `https://polygonscan.com/tx/${txHash}`

export function getReferralRewardTokenSymbol(): string {
  const addr = (REFERRAL_REWARD_TOKEN_ADDRESS || '').toLowerCase()
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    return getNativeTokenSymbol()
  }
  const entry = Object.entries(TOKEN_CONFIGS).find(
    ([tokenAddr]) => tokenAddr.toLowerCase() === addr
  )
  return entry?.[1]?.symbol ?? 'TOKEN'
}

export const getPolygonscanAddressUrl = (address: string): string =>
  `https://polygonscan.com/address/${address}`

export const isValidAddress = (address: string): boolean => {
  if (typeof address !== 'string') return false
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const getTokenConfig = (address: string) => {
  const normalizedAddress = address.toLowerCase()
  const config = Object.entries(TOKEN_CONFIGS).find(
    ([addr]) => addr.toLowerCase() === normalizedAddress
  )
  return config ? config[1] : null
}

export const SUPPORTED_TOKENS = [
  RING_TOKEN_ADDRESS,
  WPOL_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
].filter((addr) => addr !== '0x0000000000000000000000000000000000000000')
