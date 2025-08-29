export interface WalletAccount {
  address: string
  primary?: boolean
  label?: string
  createdAt?: string
}

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  decimals: number
  usdValue?: string
  tokenAddress?: string
}

export interface WalletBalances {
  RING?: string
  POL?: string
  USDT?: string
  USDC?: string
  [key: string]: string | undefined
}

export interface WalletTransaction {
  id: string
  timestamp: string
  walletAddress: string
  txHash: string
  recipient: string
  amount: string
  tokenSymbol: string
  status: 'success' | 'pending' | 'failed'
  networkId: number
  blockNumber?: number
  gasUsed?: string
  gasPrice?: string
  from?: string
  to?: string
  value?: string
  type?: 'send' | 'receive' | 'stake' | 'unstake' | 'claim' | 'buy'
  notes?: string
}

export interface WalletContact {
  id: string
  name: string
  address: string
  notes?: string
  isFavorite?: boolean
  isDefault?: boolean
  addedAt: string
  lastUsed?: string
}

export interface StakingPosition {
  poolId: string
  poolName: string
  stakedAmount: string
  pendingRewards: string
  apr: number
  tokenSymbol: string
  rewardSymbol: string
  lastClaimTime?: number
  lockEndTime?: number
}

export interface WalletAdapter {
  getPrimaryAccount(): Promise<WalletAccount | null>
  getBalances(address: string): Promise<WalletBalances>
  getTokenBalances?(address: string): Promise<TokenBalance[]>
  getTransactionHistory?(address: string, limit?: number): Promise<WalletTransaction[]>
  sendTransaction?(params: {
    from: string
    to: string
    amount: string
    tokenAddress?: string
    data?: string
  }): Promise<string>
  getStakingPositions?(address: string): Promise<StakingPosition[]>
}


