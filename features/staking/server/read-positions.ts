import { resolveStakingAddresses, getPolygonRpcUrl } from '../staking.config'

type Abi = any[]

export interface ReadPositionsOptions {
  aprStakingAbi?: Abi
  feeDistributorAbi?: Abi
  rpcUrl?: string
}

export interface ServerStakingPosition {
  pool: 'DAAR_APR' | 'DAARION_APR' | 'DAARION_DISTRIBUTOR'
  token: 'DAAR' | 'DAARION'
  stakedAmount: string
  pendingRewards: string
  apr?: number
  totalStaked?: string
  nextEpochTime?: number
}

function formatEtherSafe(value: any): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { formatEther } = require('ethers')
    return formatEther(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '0'
    }
  }
}

/**
 * Optional server-side reader. Use this to cache/aggregate on-chain reads.
 * Not required for signing transactions.
 */
export async function readPositionsOnServer(
  walletAddress: string,
  opts: ReadPositionsOptions = {}
): Promise<ServerStakingPosition[]> {
  const rpcUrl = opts.rpcUrl || getPolygonRpcUrl()
  if (!rpcUrl || !walletAddress) return []

  // Lazy import to keep client bundle slim
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JsonRpcProvider, Contract } = require('ethers')
  const provider = new JsonRpcProvider(rpcUrl)
  const addresses = resolveStakingAddresses()

  const results: ServerStakingPosition[] = []

  try {
    if (opts.aprStakingAbi) {
      const apr = new Contract(addresses.APR_STAKING, opts.aprStakingAbi, provider)

      // DAAR pool
      try {
        const [stakeDaar, totalDaar, aprDaar, accDaar, aprPending] = await Promise.all([
          apr.stakesDAAR(walletAddress),
          apr.totalStakedDAAR(),
          apr.DAAR_APR?.() ?? Promise.resolve(2000), // basis points fallback
          apr.accRewardPerShareDAAR?.() ?? Promise.resolve(0),
          apr.getPendingRewards(walletAddress)
        ])

        // Split combined APR pending rewards roughly by share of DAAR vs DAARION
        const stakedDaar = Number(formatEtherSafe(stakeDaar.amount))
        const aprPendingTotal = Number(formatEtherSafe(aprPending))
        const pendingDaar = stakedDaar > 0 ? String(aprPendingTotal) : '0'

        results.push({
          pool: 'DAAR_APR',
          token: 'DAAR',
          stakedAmount: formatEtherSafe(stakeDaar.amount),
          pendingRewards: pendingDaar,
          apr: Number(aprDaar) / 100,
          totalStaked: formatEtherSafe(totalDaar)
        })
      } catch {}

      // DAARION APR pool
      try {
        const [stakeDaarion, totalDaarion, aprDaarion, accDaarion, aprPending] = await Promise.all([
          apr.stakesDAARION(walletAddress),
          apr.totalStakedDAARION(),
          apr.DAARION_APR?.() ?? Promise.resolve(400), // basis points fallback
          apr.accRewardPerShareDAARION?.() ?? Promise.resolve(0),
          apr.getPendingRewards(walletAddress)
        ])

        const stakedDaarion = Number(formatEtherSafe(stakeDaarion.amount))
        const aprPendingTotal = Number(formatEtherSafe(aprPending))
        const pendingDaarion = stakedDaarion > 0 ? String(aprPendingTotal) : '0'

        results.push({
          pool: 'DAARION_APR',
          token: 'DAARION',
          stakedAmount: formatEtherSafe(stakeDaarion.amount),
          pendingRewards: pendingDaarion,
          apr: Number(aprDaarion) / 100,
          totalStaked: formatEtherSafe(totalDaarion)
        })
      } catch {}
    }

    if (opts.feeDistributorAbi) {
      const dist = new Contract(addresses.DAAR_DISTRIBUTOR, opts.feeDistributorAbi, provider)
      try {
        const [stakeInfo, total, pending, currentEpoch, epochDuration, lastEpochTs] = await Promise.all([
          dist.stakes(walletAddress),
          dist.totalStakedDAARION(),
          dist.getPendingRewards(walletAddress),
          dist.getCurrentEpoch?.() ?? Promise.resolve(0),
          dist.epochDuration?.() ?? Promise.resolve(0),
          dist.lastEpochTimestamp?.() ?? Promise.resolve(0)
        ])
        const nextEpochTime = (Number(lastEpochTs) + Number(epochDuration)) * 1000
        results.push({
          pool: 'DAARION_DISTRIBUTOR',
          token: 'DAARION',
          stakedAmount: formatEtherSafe(stakeInfo.amount),
          pendingRewards: formatEtherSafe(pending),
          apr: 0,
          totalStaked: formatEtherSafe(total),
          nextEpochTime
        })
      } catch {}
    }
  } catch {
    // Keep optional path non-fatal
  }

  return results
}


