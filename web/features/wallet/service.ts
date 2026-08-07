// TODO: Reuse code if needed.

// import type { WalletInfo, WalletAccount, WalletBalances } from './types'
// import type { Wallet } from '@/features/auth/types'
// import type { WalletService } from './services'

// export class RingWalletService {
//   private adapter: WalletService

//   constructor(adapter: WalletService) {
//     this.adapter = adapter
//   }

//   async getPrimaryWallet(): Promise<WalletInfo | null> {
//     return this.adapter.getPrimaryWallet()
//   }

//   async getBalancesForPrimaryWallet(): Promise<WalletBalances | null> {
//     const account = await this.adapter.getPrimaryWallet()
//     if (!account) return null
//     return this.adapter.getBalances(account.address)
//   }
// }
