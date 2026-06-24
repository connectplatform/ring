import type { RingChainsConfig, RingNativeChain } from '@/lib/ring-config-types'
import { getRingConfigSnapshot } from '@/lib/ring-config-core'

const DEFAULT_CHAINS: RingChainsConfig = {
  native: 'solana',
  enabled: ['solana', 'evm'],
  solana: {
    network: 'devnet',
    decimals: 8,
    sponsorAllRingTransfers: true,
    tokenProgram: 'spl-token',
    rpcUrlEnv: 'SOLANA_RPC_URL',
    commitment: 'confirmed',
  },
  evm: {
    enabled: true,
    chainId: 137,
    decimals: 18,
    legacyReferralRewards: true,
  },
  base: {
    enabled: false,
    chainId: 8453,
    decimals: 8,
    note: 'US L2 mirror — Phase 1.5',
  },
}

export function getRingChainConfig(): RingChainsConfig {
  const config = getRingConfigSnapshot()
  const chains = config.chains ?? {}
  return {
    ...DEFAULT_CHAINS,
    ...chains,
    solana: { ...DEFAULT_CHAINS.solana, ...chains.solana },
    evm: { ...DEFAULT_CHAINS.evm, ...chains.evm },
    base: { ...DEFAULT_CHAINS.base, ...chains.base },
    enabled: chains.enabled ?? DEFAULT_CHAINS.enabled,
    native: chains.native ?? DEFAULT_CHAINS.native,
  }
}

export function getNativeChain(): RingNativeChain {
  const { native, solana, enabled } = getRingChainConfig()
  const solanaReady =
    Boolean(solana?.mintAddress) &&
    Boolean(process.env.SOLANA_FEE_PAYER_PRIVATE_KEY) &&
    (enabled?.includes('solana') ?? false)

  if (native === 'solana' && solanaReady) {
    return 'solana'
  }

  return 'evm'
}

export function isChainEnabled(chain: RingNativeChain): boolean {
  const { enabled } = getRingChainConfig()
  return enabled?.includes(chain) ?? chain === 'evm'
}

export function getRingTokenDecimals(chain?: RingNativeChain): number {
  const active = chain ?? getNativeChain()
  const chains = getRingChainConfig()
  const config = getRingConfigSnapshot()

  if (active === 'solana') {
    return chains.solana?.decimals ?? config.tokens?.ring?.decimals ?? 8
  }

  return chains.evm?.decimals ?? config.tokens?.ring?.decimals ?? 18
}

export function getRingTokenMintOrAddress(chain?: RingNativeChain): string | null {
  const active = chain ?? getNativeChain()
  const chains = getRingChainConfig()

  if (active === 'solana') {
    return chains.solana?.mintAddress ?? null
  }

  return (
    chains.evm?.tokenAddress ||
    process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS ||
    process.env.REFERRAL_REWARD_TOKEN_ADDRESS ||
    null
  )
}

export function getRingTokensConfig() {
  return getRingConfigSnapshot().tokens ?? {}
}

export function getRingCreditUnit(): string {
  return getRingTokensConfig().creditUnit ?? 'USD'
}

export function getRingCreditFiatCurrency(): string {
  return getRingTokensConfig().creditFiatCurrency ?? getRingCreditUnit()
}

export function getRingAirdropConfig() {
  return getRingTokensConfig().airdrops ?? {}
}

export function getRingDeskConfig() {
  return getRingTokensConfig().desk ?? {}
}

export function assertMainnetHotKeyAllowed(operation: string): void {
  const chains = getRingChainConfig()
  if (chains.solana?.network === 'mainnet' && process.env.SOLANA_TREASURY_PRIVATE_KEY) {
    throw new Error(
      `Hot-key ${operation} blocked on Solana mainnet — use Squads multisig treasury (Phase 3)`,
    )
  }
}
