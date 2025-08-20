import type { StakingAdapter, StakingPosition, StakingPool } from '../types'
import { parseTokenAmount } from '../../evm/utils'

type EthersLikeContract = any
type EthersLikeSigner = any

export interface EvmTokenConfig {
  address: string
  decimals?: number
  symbol: 'DAAR' | 'DAARION'
}

export interface EvmContractConfig {
  address: string
  abi: any[]
}

export interface EvmStakingConfig {
  tokens: {
    DAAR?: EvmTokenConfig
    DAARION?: EvmTokenConfig
  }
  contracts: {
    aprStaking?: EvmContractConfig
    feeDistributor?: EvmContractConfig
    erc20?: { abi: any[] }
  }
  methods?: {
    stakeDAAR?: string
    stakeDAARION?: string
    unstakeDAAR?: string
    unstakeDAARION?: string
    claimDAAR?: string
    claimDAARION?: string
  }
  getSigner: () => Promise<EthersLikeSigner | null>
  /** Optional reader to obtain positions from chain or cache */
  readPositions?: (address: string) => Promise<StakingPosition[]>
}

const MINIMAL_ERC20_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
]

function toContract(address: string, abi: any[], signer: EthersLikeSigner): EthersLikeContract {
  // Lazy require to avoid hard dependency when unused (SSR compatible)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Contract } = require('ethers')
  return new Contract(address, abi, signer)
}

export function createEvmStakingAdapter(config: EvmStakingConfig): StakingAdapter {
  const {
    tokens,
    contracts,
    methods = {}
  } = config

  const erc20Abi = contracts.erc20?.abi || MINIMAL_ERC20_ABI

  async function withSigner<T>(fn: (signer: EthersLikeSigner) => Promise<T>): Promise<T> {
    const signer = await config.getSigner()
    if (!signer) throw new Error('Wallet not connected')
    return fn(signer)
  }

  async function ensureApproval(
    signer: EthersLikeSigner,
    tokenAddress: string,
    spender: string,
    amountRaw: string
  ) {
    const owner = await signer.getAddress()
    const erc20 = toContract(tokenAddress, erc20Abi, signer)
    const current = await erc20.allowance(owner, spender)
    // ethers v6 BigInt-like; normalize to bigint for comparison
    const currentBig = typeof current === 'bigint' ? current : BigInt(String(current))
    const neededBig = BigInt(amountRaw)
    if (currentBig >= neededBig) return
    const tx = await erc20.approve(spender, neededBig)
    await tx.wait()
  }

  return {
    async getPositions(address: string): Promise<StakingPosition[]> {
      if (config.readPositions) return config.readPositions(address)
      // Fallback: return empty when no reader provided
      return []
    },

    async stake(token, amount) {
      return withSigner(async (signer) => {
        const amountRaw = parseTokenAmount(amount, (token === 'DAAR' ? tokens.DAAR?.decimals : tokens.DAARION?.decimals) || 18)

        if (token === 'DAAR') {
          if (!contracts.aprStaking || !tokens.DAAR) throw new Error('DAAR staking not configured')
          const staking = toContract(contracts.aprStaking.address, contracts.aprStaking.abi, signer)
          await ensureApproval(signer, tokens.DAAR.address, contracts.aprStaking.address, amountRaw)
          const method = methods.stakeDAAR || 'stakeDAAR'
          const tx = await staking[method](amountRaw)
          const receipt = await tx.wait()
          return { txHash: receipt?.hash || tx.hash }
        }

        if (token === 'DAARION') {
          // Prefer APR contract if present, else fee distributor
          const target = contracts.aprStaking || contracts.feeDistributor
          if (!target || !tokens.DAARION) throw new Error('DAARION staking not configured')
          const staking = toContract(target.address, target.abi, signer)
          await ensureApproval(signer, tokens.DAARION.address, target.address, amountRaw)
          const method = methods.stakeDAARION || 'stakeDAARION'
          const tx = await staking[method](amountRaw)
          const receipt = await tx.wait()
          return { txHash: receipt?.hash || tx.hash }
        }

        throw new Error('Unsupported token')
      })
    },

    async unstake(token, amount) {
      return withSigner(async (signer) => {
        const amountRaw = parseTokenAmount(amount, (token === 'DAAR' ? tokens.DAAR?.decimals : tokens.DAARION?.decimals) || 18)

        if (token === 'DAAR') {
          if (!contracts.aprStaking) throw new Error('DAAR staking not configured')
          const staking = toContract(contracts.aprStaking.address, contracts.aprStaking.abi, signer)
          const method = methods.unstakeDAAR || 'unstakeDAAR'
          const tx = await staking[method](amountRaw)
          const receipt = await tx.wait()
          return { txHash: receipt?.hash || tx.hash }
        }

        if (token === 'DAARION') {
          const target = contracts.aprStaking || contracts.feeDistributor
          if (!target) throw new Error('DAARION staking not configured')
          const staking = toContract(target.address, target.abi, signer)
          const method = methods.unstakeDAARION || 'unstakeDAARION'
          const tx = await staking[method](amountRaw)
          const receipt = await tx.wait()
          return { txHash: receipt?.hash || tx.hash }
        }

        throw new Error('Unsupported token')
      })
    },

    async claimRewards(token) {
      return withSigner(async (signer) => {
        if (token === 'DAAR') {
          if (!contracts.aprStaking) throw new Error('DAAR staking not configured')
          const staking = toContract(contracts.aprStaking.address, contracts.aprStaking.abi, signer)
          const method = methods.claimDAAR || methods.claimDAARION || 'claimReward'
          const tx = await staking[method]()
          const receipt = await tx.wait()
          return { txHash: receipt?.hash || tx.hash }
        }

        if (token === 'DAARION') {
          // Prefer APR contract for claim; distributor may auto-distribute
          if (contracts.aprStaking) {
            const staking = toContract(contracts.aprStaking.address, contracts.aprStaking.abi, signer)
            const method = methods.claimDAARION || methods.claimDAAR || 'claimReward'
            const tx = await staking[method]()
            const receipt = await tx.wait()
            return { txHash: receipt?.hash || tx.hash }
          }
          // If only distributor is configured and it exposes a claim, call it; otherwise no-op
          if (contracts.feeDistributor) {
            const hasClaim = methods.claimDAARION && typeof methods.claimDAARION === 'string'
            if (hasClaim) {
              const dist = toContract(contracts.feeDistributor.address, contracts.feeDistributor.abi, signer)
              const tx = await dist[methods.claimDAARION]()
              const receipt = await tx.wait()
              return { txHash: receipt?.hash || tx.hash }
            }
            // No claim method: treat as auto-distributed
            return { txHash: '' }
          }
          throw new Error('DAARION staking not configured')
        }

        throw new Error('Unsupported token')
      })
    },

    async stakeByPool(pool: StakingPool, amount: string) {
      const token = pool === 'DAAR_APR' ? 'DAAR' : 'DAARION'
      return this.stake(token as 'DAAR' | 'DAARION', amount)
    },

    async unstakeByPool(pool: StakingPool, amount: string) {
      const token = pool === 'DAAR_APR' ? 'DAAR' : 'DAARION'
      return this.unstake(token as 'DAAR' | 'DAARION', amount)
    },

    async claimByPool(pool: StakingPool) {
      if (pool === 'DAAR_APR') return this.claimRewards('DAAR')
      if (pool === 'DAARION_APR') return this.claimRewards('DAARION')
      // Distributor: only claim if method provided; else no-op
      if (pool === 'DAARION_DISTRIBUTOR') {
        if (contracts.feeDistributor && methods.claimDAARION) {
          return withSigner(async (signer) => {
            const dist = toContract(contracts.feeDistributor!.address, contracts.feeDistributor!.abi, signer)
            const tx = await dist[methods.claimDAARION!]()
            const receipt = await tx.wait()
            return { txHash: receipt?.hash || tx.hash }
          })
        }
        return { txHash: '' }
      }
      return { txHash: '' }
    }
  }
}

// Note: The interface EvmStakingConfig is already exported above


