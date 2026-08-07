// features/staking/slots.ts  (new file — ring-config SSOT accessors)
import 'server-only'
import { getNativeChainConfig, getNativeChain, isChainEnabled,
         getNativeTokenDecimals, getNativeTokenMintOrAddress,
         getNativeTokenConfig } from '@/lib/ring-config-chain'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { NativeChain, EvmChainConfig } from '@/lib/ring-config-chain'

const resolveRpc = (envKey?: string, fallback?: string): string =>
  (envKey ? process.env[envKey] : undefined) ?? fallback ?? ''

/** "ring-wallet" — the default-chain wallet slot. */
export function getRingWalletSlot(): { defaultChain: NativeChain; multiChainEnabled: boolean } {
  const cfg = getNativeChainConfig()
  return {
    defaultChain: getNativeChain(),
    multiChainEnabled: (cfg.enabled?.length ?? 0) > 1,
  }
}

/** "native-token" — sponsored SPL custom-project token (RING). */
export function getNativeTokenSlot(): { enabled: boolean; tokenAddress: string | null; treasuryAddress: string | null; decimals: number; sponsorAllTransfers: boolean; tokenProgram: string; rpcUrl: string } {
  const s = getNativeChainConfig().solana ?? {}
  return {
    enabled: isChainEnabled('solana') && Boolean(s.tokenAddress),
    tokenAddress: s.tokenAddress ?? null,
    treasuryAddress: s.treasuryAddress ?? null,
    decimals: getNativeTokenDecimals('solana'),
    sponsorAllTransfers: s.sponsorAllNativeTokenTransfers ?? true,
    tokenProgram: s.tokenProgram ?? 'spl-token',
    rpcUrl: resolveRpc(s.rpcUrlEnv ?? 'SOLANA_RPC_URL'),
  }
}

/** "evm-chain-wallet" — on polygon chain (chainId 137). */
export function getEvmChainWalletSlot(): EvmChainConfig {
  const e = getNativeChainConfig().evm ?? {}
  return {
    enabled: e.enabled ?? true,
    chainId: e.chainId ?? 137,
    tokenSymbol: e.tokenSymbol ?? 'RING',
    tokenDecimals: e.tokenDecimals ?? getNativeTokenDecimals('evm'),
    tokenAddress: e.tokenAddress ?? getNativeTokenMintOrAddress('evm') ?? undefined,
    rpcUrlEnv: e.rpcUrlEnv ?? 'POLYGON_RPC_URL',
    commitment: e.commitment ?? 'confirmed',
    // Raw staking slot passthrough — buildEvmStakingConfigFromSSOT validates it.
    staking: {
      pools: e.staking?.pools,
      poolToToken: e.staking?.poolToToken,
      contracts: {
        aprStaking: e.staking?.contracts?.aprStaking ?? null,
        feeDistributor: e.staking?.contracts?.feeDistributor ?? null,
        erc20: e.staking?.contracts?.erc20 ?? null,
      },
      methods: e.staking?.methods,
    },
  }
}

/** "base-chain-token" — Base L2 mirror (chainId 8453, Phase 1.5). */
export function getBaseChainTokenSlot(): {
  enabled: boolean
  chainId: number
  tokenSymbol: string
  tokenAddress: string | null
  decimals: number
  rpcUrl: string
} {
  const b = getNativeChainConfig().base ?? {}
  return {
    enabled: b.enabled ?? false,
    chainId: b.chainId ?? 8453,
    tokenSymbol: b.tokenSymbol ?? 'RING',
    tokenAddress: b.tokenAddress ?? null,
    decimals: getNativeTokenDecimals('base'),
    rpcUrl: resolveRpc(b.rpcUrlEnv ?? 'BASE_RPC_URL'),
  }
}