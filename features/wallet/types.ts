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

// ============================================================================
// PROJECT-SPECIFIC WALLET TYPES
// ============================================================================

export interface ProjectWalletData {
  id: string
  globalUserId: string
  projectSlug: string
  address: string
  primary: boolean
  label: string
  encryptedPrivateKey: string
  publicKey: string
  networkId: number
  createdAt: Date
  lastUsed: Date
}

export interface ProjectWalletService {
  // Wallet Management
  ensureProjectWallet(globalUserId: string): Promise<WalletAccount>
  getProjectWallets(globalUserId: string): Promise<WalletAccount[]>
  hasProjectWallet(globalUserId: string): Promise<boolean>
  getPrimaryProjectWallet(globalUserId: string): Promise<WalletAccount | null>

  // Contact Management
  addContact(globalUserId: string, contactData: Omit<WalletContact, 'id' | 'addedAt'>): Promise<WalletContact>
  getContacts(globalUserId: string): Promise<WalletContact[]>
  contactExists(globalUserId: string, address: string): Promise<boolean>
  removeContact(globalUserId: string, contactId: string): Promise<void>

  // Token Transfer
  sendTokens(params: {
    globalUserId: string
    fromAddress: string
    toAddress: string
    amount: string
    tokenSymbol: string
    notes?: string
  }): Promise<WalletTransaction>

  // Transaction History
  getTransactionHistory(globalUserId: string, limit?: number): Promise<WalletTransaction[]>
}


