/**
 * features/staking/adapters/base.ts — Base L2 staking (Phase 1.5 placeholder).
 *
 * Base (chainId 8453) is EVM-compatible: when Base staking ships, REUSE
 * buildEvmStakingConfigFromSSOT + createEvmStakingAdapter from ./evm with the
 * base chain slot (chains.base) — do NOT fork the adapter. This module only
 * owns the raw slot type so lib/ring-config-chain can type chains.base.staking.
 */
import type { EvmStakingSlotConfig } from './evm'

/** Raw staking section of the Base chain slot in ring-config.json (EVM-shaped). */
export interface BaseStakingConfig extends EvmStakingSlotConfig {
  enabled?: boolean
}
