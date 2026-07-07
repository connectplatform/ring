/**
 * features/staking/server/read-positions.ts — server-side EVM position reader.
 *
 * Optional cached/aggregated on-chain reads for the wallet staking page.
 * Inject through buildEvmStakingConfigFromSSOT({ readPositions }) so the
 * adapter's getPositions() resolves server-side without client RPC fan-out.
 * Not required for signing transactions.
 *
 * Contract read surface (see legacy sources in daarion/daarion-token/contracts):
 *   APRStaking.sol      — stakesDAAR(addr), stakesDAARION(addr), totalStakedDAAR(),
 *                         totalStakedDAARION(), DAAR_APR(), DAARION_APR(),
 *                         getPendingRewards(addr)  [combined across both APR pools]
 *   DAARDistributor.sol — stakes(addr), totalStakedDAARION(),
 *                         getPendingRewardsDAARDistributor(addr),
 *                         getCurrentEpoch(), epochDuration(), lastEpochTimestamp()
 */
import 'server-only'
import type { EvmAbi } from '../adapters/evm'
import { isDeployedEvmAddress } from '../adapters/evm'
import { getEvmChainWalletSlot } from '../slots'
import { getPolygonRpcUrl } from '../staking.config'
import type { StakingPosition } from '../types'

export interface ReadPositionsOptions {
  aprStakingAbi?: EvmAbi
  feeDistributorAbi?: EvmAbi
  rpcUrl?: string
  /** Explicit address overrides; default from chains.evm.staking.contracts. */
  aprStakingAddress?: string
  feeDistributorAddress?: string
}

export type ServerStakingPosition = StakingPosition

function contractAddressFrom(raw: unknown): string | undefined {
  if (typeof raw === 'string') return isDeployedEvmAddress(raw) ? raw : undefined
  if (typeof raw === 'object' && raw !== null) {
    const addr = (raw as { address?: unknown }).address
    return typeof addr === 'string' && isDeployedEvmAddress(addr) ? addr : undefined
  }
  return undefined
}

/**
 * Read staking positions on the server. Non-fatal by design: individual pool
 * read failures degrade to omission, never to a thrown 500 on the wallet page.
 */
export async function readPositionsOnServer(
  walletAddress: string,
  opts: ReadPositionsOptions = {}
): Promise<ServerStakingPosition[]> {
  const slot = getEvmChainWalletSlot()
  const rpcUrl = opts.rpcUrl || getPolygonRpcUrl()
  if (!rpcUrl || !walletAddress) return []

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JsonRpcProvider, Contract, formatUnits } = require('ethers')
  const provider = new JsonRpcProvider(rpcUrl)
  const decimals = slot.tokenDecimals ?? 18
  const fmt = (v: unknown): string => {
    try { return formatUnits(v as bigint, decimals) } catch { return '0' }
  }

  const aprAddress = opts.aprStakingAddress ?? contractAddressFrom(slot.staking?.contracts?.aprStaking)
  const distAddress = opts.feeDistributorAddress ?? contractAddressFrom(slot.staking?.contracts?.feeDistributor)

  const results: ServerStakingPosition[] = []

  // ---- APRStaking pools (DAAR_APR, DAARION_APR) ----
  if (aprAddress && opts.aprStakingAbi) {
    const apr = new Contract(aprAddress, opts.aprStakingAbi, provider)

    try {
      const [stakeDaar, totalDaar, aprDaar, pendingTotal] = await Promise.all([
        apr.stakesDAAR(walletAddress),
        apr.totalStakedDAAR(),
        apr.DAAR_APR?.() ?? Promise.resolve(2000n),
        apr.getPendingRewards(walletAddress),
      ])
      results.push({
        pool: 'DAAR_APR',
        token: 'DAAR',
        rewardToken: 'DAAR',
        stakedAmount: fmt(stakeDaar.amount),
        // getPendingRewards is combined across both APR pools — attribute to
        // the pool the user actually staked in (0 when unstaked).
        pendingRewards: Number(fmt(stakeDaar.amount)) > 0 ? fmt(pendingTotal) : '0',
        apr: Number(aprDaar) / 100,
        totalStaked: fmt(totalDaar),
      })
    } catch { /* pool read degraded — omit */ }

    try {
      const [stakeDaarion, totalDaarion, aprDaarion, pendingTotal] = await Promise.all([
        apr.stakesDAARION(walletAddress),
        apr.totalStakedDAARION(),
        apr.DAARION_APR?.() ?? Promise.resolve(400n),
        apr.getPendingRewards(walletAddress),
      ])
      results.push({
        pool: 'DAARION_APR',
        token: 'DAARION',
        rewardToken: 'DAAR',
        stakedAmount: fmt(stakeDaarion.amount),
        pendingRewards: Number(fmt(stakeDaarion.amount)) > 0 ? fmt(pendingTotal) : '0',
        apr: Number(aprDaarion) / 100,
        totalStaked: fmt(totalDaarion),
      })
    } catch { /* pool read degraded — omit */ }
  }

  // ---- DAARDistributor pool (DAARION_DISTRIBUTOR) ----
  if (distAddress && opts.feeDistributorAbi) {
    const dist = new Contract(distAddress, opts.feeDistributorAbi, provider)
    try {
      const [stakeInfo, total, pending, epochDuration, lastEpochTs] = await Promise.all([
        dist.stakes(walletAddress),
        dist.totalStakedDAARION(),
        dist.getPendingRewardsDAARDistributor(walletAddress),
        dist.epochDuration?.() ?? Promise.resolve(0n),
        dist.lastEpochTimestamp?.() ?? Promise.resolve(0n),
      ])
      results.push({
        pool: 'DAARION_DISTRIBUTOR',
        token: 'DAARION',
        rewardToken: 'DAAR',
        stakedAmount: fmt(stakeInfo.amount),
        pendingRewards: fmt(pending),
        totalStaked: fmt(total),
        nextEpochTime: (Number(lastEpochTs) + Number(epochDuration)) * 1000,
      })
    } catch { /* pool read degraded — omit */ }
  }

  return results
}
