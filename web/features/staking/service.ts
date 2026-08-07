import type { StakingAdapter, StakingPosition, StakingPool } from './types'

export class RingStakingService {
  private adapter: StakingAdapter

  constructor(adapter: StakingAdapter) {
    this.adapter = adapter
  }

  async getUserPositions(address: string): Promise<StakingPosition[]> {
    return this.adapter.getPositions(address)
  }

  async stakeDaar(amount: string) {
    return this.adapter.stake('DAAR', amount)
  }

  async stakeDaarion(amount: string) {
    return this.adapter.stake('DAARION', amount)
  }

  async unstakeDaar(amount: string) {
    return this.adapter.unstake('DAAR', amount)
  }

  async unstakeDaarion(amount: string) {
    return this.adapter.unstake('DAARION', amount)
  }

  async claimDaarRewards() {
    return this.adapter.claimRewards('DAAR')
  }

  async claimDaarionRewards() {
    return this.adapter.claimRewards('DAARION')
  }

  async stakeByPool(pool: StakingPool, amount: string) {
    return this.adapter.stakeByPool(pool, amount)
  }

  async unstakeByPool(pool: StakingPool, amount: string) {
    return this.adapter.unstakeByPool(pool, amount)
  }

  async claimByPool(pool: StakingPool) {
    return this.adapter.claimByPool(pool)
  }
}


