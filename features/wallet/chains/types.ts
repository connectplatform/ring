import type { Wallet } from '@/features/auth/types'
import type { WalletChain } from '@/features/wallet/services/utils'

export interface GeneratedChainWallet {
  chain: WalletChain
  address: string
  secret: string
  label: string
}

export interface ChainWalletAdapter {
  chain: WalletChain
  label: string
  generate(): Promise<GeneratedChainWallet>
}
