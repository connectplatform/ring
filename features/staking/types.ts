export type StakingPool = 'DAAR_APR' | 'DAARION_APR' | 'DAARION_DISTRIBUTOR'

export interface StakingPosition {
  pool: StakingPool
  token: 'DAAR' | 'DAARION'
  rewardToken?: 'DAAR' | 'DAARION'
  stakedAmount: string
  pendingRewards: string
  apr?: number
  totalStaked?: string
  nextEpochTime?: number
  lastUpdateTime?: number
}

export interface StakingAdapter {
  getPositions(address: string): Promise<StakingPosition[]>
  // Backward-compat convenience
  stake(token: 'DAAR' | 'DAARION', amount: string): Promise<{ txHash: string }>
  unstake(token: 'DAAR' | 'DAARION', amount: string): Promise<{ txHash: string }>
  claimRewards(token: 'DAAR' | 'DAARION'): Promise<{ txHash: string }>
  // Pool-specific operations
  stakeByPool(pool: StakingPool, amount: string): Promise<{ txHash: string }>
  unstakeByPool(pool: StakingPool, amount: string): Promise<{ txHash: string }>
  claimByPool(pool: StakingPool): Promise<{ txHash: string }>
}


