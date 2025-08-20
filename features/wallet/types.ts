export interface WalletAccount {
  address: string
  primary?: boolean
}

export interface WalletBalances {
  DAAR?: string
  DAARION?: string
  USDT?: string
}

export interface WalletAdapter {
  getPrimaryAccount(): Promise<WalletAccount | null>
  getBalances(address: string): Promise<WalletBalances>
}


