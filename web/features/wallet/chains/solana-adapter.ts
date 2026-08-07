import 'server-only'

import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import type { ChainWalletAdapter, GeneratedChainWallet } from '@/features/wallet/types/wallet'

export const solanaChainAdapter: ChainWalletAdapter = {
  chain: 'solana' as const,
  label: 'Native Token Chain (Solana)',
  getChainLabel() {
    return this.label
  },
  async generate() {
    const keypair = Keypair.generate()
    const wallet: GeneratedChainWallet = {
      chain: this.chain,
      address: keypair.publicKey.toBase58(),
      secret: bs58.encode(keypair.secretKey),
      label: this.label,
    }
    return wallet
  },
}
