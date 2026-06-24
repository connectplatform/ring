import 'server-only'

import type { WalletChain } from '@/features/wallet/services/utils'
import { evmAdapter } from './evm-adapter'
import { solanaAdapter } from './solana-adapter'
import type { ChainWalletAdapter } from './types'

const adapters: Record<WalletChain, ChainWalletAdapter> = {
  solana: solanaAdapter,
  evm: evmAdapter,
}

export function getChainAdapter(chain: WalletChain): ChainWalletAdapter {
  const adapter = adapters[chain]
  if (!adapter) {
    throw new Error(`No wallet adapter registered for chain: ${chain}`)
  }
  return adapter
}
