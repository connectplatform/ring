import type { EvmStakingConfig } from './adapters/evm'

export type StakingEnvironment = 'development' | 'test' | 'staging' | 'production' | 'custom'

export interface StakingAddresses {
  DAAR: string
  DAARION: string
  APR_STAKING: string
  DAAR_DISTRIBUTOR: string
}

export interface BuildAdapterOptions {
  getSigner: () => Promise<any | null>
  aprStakingAbi: any[]
  feeDistributorAbi: any[]
  erc20Abi?: any[]
}

/**
 * Polygon mainnet addresses from daarion token docs
 * README.ADDRESSES.md
 */
export const POLYGON_MAINNET_ADDRESSES: StakingAddresses = {
  DAAR: '0x5aF82259455a963eC20Ea92471f55767B5919E38',
  DAARION: '0x8Fe60b6F2DCBE68a1659b81175C665EB94015B16',
  APR_STAKING: '0xe9a321c213d837379ebD7027CE685B62dFDb8c3b',
  DAAR_DISTRIBUTOR: '0x605F5F73536ab6099ADc4381A3713Eab73384BE5'
}

export function getStakingEnvironment(): StakingEnvironment {
  const env = (process.env.RING_ENV || process.env.NODE_ENV || 'development').toLowerCase()
  if (env.startsWith('prod')) return 'production'
  if (env.startsWith('stag')) return 'staging'
  if (env.startsWith('test')) return 'test'
  if (env.startsWith('dev')) return 'development'
  return 'custom'
}

export function getEnvAddressesFallback(): Partial<StakingAddresses> {
  return {
    DAAR: process.env.RING_DAAR_ADDRESS || process.env.NEXT_PUBLIC_DAAR_ADDRESS,
    DAARION: process.env.RING_DAARION_ADDRESS || process.env.NEXT_PUBLIC_DAARION_ADDRESS,
    APR_STAKING: process.env.RING_APR_STAKING_ADDRESS || process.env.NEXT_PUBLIC_APR_STAKING_ADDRESS,
    DAAR_DISTRIBUTOR: process.env.RING_DAAR_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_DAAR_DISTRIBUTOR_ADDRESS
  } as Partial<StakingAddresses>
}

export function resolveStakingAddresses(
  overrides?: Partial<StakingAddresses>
): StakingAddresses {
  const env = getStakingEnvironment()
  const fromEnv = getEnvAddressesFallback()

  // For production default to Polygon mainnet unless explicit overrides provided
  const base: StakingAddresses = env === 'production'
    ? { ...POLYGON_MAINNET_ADDRESSES }
    : { ...POLYGON_MAINNET_ADDRESSES }

  const merged = {
    ...base,
    ...fromEnv,
    ...overrides
  } as StakingAddresses

  return merged
}

export function buildEvmStakingConfig(
  options: BuildAdapterOptions,
  addressOverrides?: Partial<StakingAddresses>
): EvmStakingConfig {
  const addresses = resolveStakingAddresses(addressOverrides)
  return {
    tokens: {
      DAAR: { address: addresses.DAAR, decimals: 18, symbol: 'DAAR' },
      DAARION: { address: addresses.DAARION, decimals: 18, symbol: 'DAARION' }
    },
    contracts: {
      aprStaking: { address: addresses.APR_STAKING, abi: options.aprStakingAbi },
      feeDistributor: { address: addresses.DAAR_DISTRIBUTOR, abi: options.feeDistributorAbi },
      erc20: options.erc20Abi ? { abi: options.erc20Abi } : undefined
    },
    getSigner: options.getSigner
  }
}

export function getPolygonRpcUrl(): string | undefined {
  return process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL
}


