/**
 * features/staking/staking.config.ts — environment helpers + legacy facade.
 *
 * The SINGLE validated path to a staking config is
 * buildEvmStakingConfigFromSSOT (adapters/evm.ts). This module keeps the
 * legacy buildEvmStakingConfig(options) entrypoint as a thin delegating
 * facade so older call sites keep working while inheriting the hardened
 * validation (fail-fast, cross-checked, frozen output).
 */
import type { EvmAbi, EvmStakingConfig, EvmStakingSlotConfig } from './adapters/evm'
import { buildEvmStakingConfigFromSSOT } from './adapters/evm'
import { getEvmChainWalletSlot } from './slots'

export type StakingEnvironment = 'development' | 'test' | 'staging' | 'production' | 'custom'

export interface BuildAdapterOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSigner: () => Promise<any | null>
  aprStakingAbi: EvmAbi
  feeDistributorAbi: EvmAbi
  erc20Abi?: EvmAbi
}

export function getStakingEnvironment(): StakingEnvironment {
  const env = (process.env.RING_ENV || process.env.NODE_ENV || 'development').toLowerCase()
  if (env.startsWith('prod')) return 'production'
  if (env.startsWith('stag')) return 'staging'
  if (env.startsWith('test')) return 'test'
  if (env.startsWith('dev')) return 'development'
  return 'custom'
}

/**
 * Return the RAW staking slot (optionally overlaid with explicit overrides).
 * Raw slots are UNTRUSTED — pass through buildEvmStakingConfigFromSSOT before
 * handing anything to an adapter.
 */
export function resolveStakingAddresses(
  overrides?: Partial<EvmStakingSlotConfig>
): EvmStakingSlotConfig {
  const slot = getEvmChainWalletSlot()
  return {
    ...(slot?.staking ?? {}),
    ...(overrides ?? {}),
  }
}

/**
 * Legacy facade — delegates to the validated SSOT builder.
 * Throws StakingConfigError / StakingError on any malformed config (fail-fast).
 */
export function buildEvmStakingConfig(options: BuildAdapterOptions): EvmStakingConfig {
  return buildEvmStakingConfigFromSSOT({
    getSigner: options.getSigner,
    abis: {
      aprStaking: options.aprStakingAbi,
      feeDistributor: options.feeDistributorAbi,
      erc20: options.erc20Abi,
    },
  })
}

export function getPolygonRpcUrl(): string | undefined {
  return process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL
}
