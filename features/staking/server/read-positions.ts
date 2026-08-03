/**
 * features/staking/server/read-positions.ts — server-side EVM position reader (viem).
 */
import 'server-only'
import { createPublicClient, http, formatUnits, type Abi } from 'viem'
import { polygon } from 'viem/chains'
import type { EvmAbi } from '../adapters/evm'
import { isDeployedEvmAddress } from '../adapters/evm'
import { getEvmChainWalletSlot } from '../slots'
import { getPolygonRpcUrl } from '../staking.config'
import type { StakingPosition } from '../types'

export interface ReadPositionsOptions {
  aprStakingAbi?: EvmAbi
  feeDistributorAbi?: EvmAbi
  rpcUrl?: string
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

function toAbi(abi: EvmAbi): Abi {
  return abi as Abi
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

  const client = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl),
  })

  const read = async (
    address: `0x${string}`,
    abi: Abi,
    functionName: string,
    args: unknown[] = []
  ): Promise<unknown> =>
    client.readContract({
      address,
      abi,
      functionName,
      args,
    } as never)

  const decimals = slot.tokenDecimals ?? 18
  const fmt = (v: unknown): string => {
    try {
      return formatUnits(v as bigint, decimals)
    } catch {
      return '0'
    }
  }

  const aprAddress = opts.aprStakingAddress ?? contractAddressFrom(slot.staking?.contracts?.aprStaking)
  const distAddress =
    opts.feeDistributorAddress ?? contractAddressFrom(slot.staking?.contracts?.feeDistributor)

  const results: ServerStakingPosition[] = []
  const wallet = walletAddress as `0x${string}`

  if (aprAddress && opts.aprStakingAbi) {
    const abi = toAbi(opts.aprStakingAbi)
    const addr = aprAddress as `0x${string}`

    try {
      const [stakeDaar, totalDaar, aprDaar, pendingTotal] = await Promise.all([
        read(addr, abi, 'stakesDAAR', [wallet]),
        read(addr, abi, 'totalStakedDAAR'),
        read(addr, abi, 'DAAR_APR').catch(() => 2000n),
        read(addr, abi, 'getPendingRewards', [wallet]),
      ])
      const amount = (stakeDaar as { amount?: unknown })?.amount ?? stakeDaar
      results.push({
        pool: 'DAAR_APR',
        token: 'DAAR',
        rewardToken: 'DAAR',
        stakedAmount: fmt(amount),
        pendingRewards: Number(fmt(amount)) > 0 ? fmt(pendingTotal) : '0',
        apr: Number(aprDaar) / 100,
        totalStaked: fmt(totalDaar),
      })
    } catch {
      /* omit */
    }

    try {
      const [stakeDaarion, totalDaarion, aprDaarion, pendingTotal] = await Promise.all([
        read(addr, abi, 'stakesDAARION', [wallet]),
        read(addr, abi, 'totalStakedDAARION'),
        read(addr, abi, 'DAARION_APR').catch(() => 400n),
        read(addr, abi, 'getPendingRewards', [wallet]),
      ])
      const amount = (stakeDaarion as { amount?: unknown })?.amount ?? stakeDaarion
      results.push({
        pool: 'DAARION_APR',
        token: 'DAARION',
        rewardToken: 'DAAR',
        stakedAmount: fmt(amount),
        pendingRewards: Number(fmt(amount)) > 0 ? fmt(pendingTotal) : '0',
        apr: Number(aprDaarion) / 100,
        totalStaked: fmt(totalDaarion),
      })
    } catch {
      /* omit */
    }
  }

  if (distAddress && opts.feeDistributorAbi) {
    const abi = toAbi(opts.feeDistributorAbi)
    const addr = distAddress as `0x${string}`
    try {
      const [stakeInfo, total, pending, epochDuration, lastEpochTs] = await Promise.all([
        read(addr, abi, 'stakes', [wallet]),
        read(addr, abi, 'totalStakedDAARION'),
        read(addr, abi, 'getPendingRewardsDAARDistributor', [wallet]),
        read(addr, abi, 'epochDuration').catch(() => 0n),
        read(addr, abi, 'lastEpochTimestamp').catch(() => 0n),
      ])
      const amount = (stakeInfo as { amount?: unknown })?.amount ?? stakeInfo
      results.push({
        pool: 'DAARION_DISTRIBUTOR',
        token: 'DAARION',
        rewardToken: 'DAAR',
        stakedAmount: fmt(amount),
        pendingRewards: fmt(pending),
        totalStaked: fmt(total),
        nextEpochTime: (Number(lastEpochTs) + Number(epochDuration)) * 1000,
      })
    } catch {
      /* omit */
    }
  }

  return results
}
