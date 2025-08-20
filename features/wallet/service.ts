import { WalletAdapter, WalletBalances, WalletAccount } from './types'

export class RingWalletService {
  private adapter: WalletAdapter

  constructor(adapter: WalletAdapter) {
    this.adapter = adapter
  }

  async getPrimaryAccount(): Promise<WalletAccount | null> {
    return this.adapter.getPrimaryAccount()
  }

  async getBalancesForPrimary(): Promise<WalletBalances | null> {
    const account = await this.adapter.getPrimaryAccount()
    if (!account) return null
    return this.adapter.getBalances(account.address)
  }
}


