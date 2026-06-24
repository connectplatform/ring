import 'server-only'

import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import type { ChainWalletAdapter } from './types'

export const solanaAdapter: ChainWalletAdapter = {
  chain: 'solana',
  label: 'Ring Wallet (Solana)',

  async generate() {
    const keypair = Keypair.generate()
    return {
      chain: 'solana',
      address: keypair.publicKey.toBase58(),
      secret: bs58.encode(keypair.secretKey),
      label: 'Ring Wallet (Solana)',
    }
  },
}
