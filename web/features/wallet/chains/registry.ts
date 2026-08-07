import 'server-only' // Ensures this module is only loaded on the server, an optimization in Next.js apps

import { solanaChainAdapter } from './solana-adapter'
import type { ChainWalletAdapter } from '@/features/wallet/types/wallet'
import type { NativeChain } from '@/lib/ring-config-chain'
import { logger } from '@/lib/logger'

// Mapping of supported native chains to their respective wallet adapters, except those lazily loaded.
// Update as new chains/adapters are added.
const adapters: Partial<Record<NativeChain, ChainWalletAdapter>> = {
  solana: solanaChainAdapter,  // Solana chain adapter
  // evm and base will be handled via dynamic import
  // TODO TBD: support of more popular chains (e.g., Aptos, Sui, Ripple),
  //   1. Implement corresponding adapter,
  //   2. Add to this mapping or handle via dynamic import.
}

// Function to retrieve the correct wallet adapter for a given chain.
// Throws a descriptive error if chain is not registered.
// For the 'evm' and 'base' chains, dynamically imports adapters for lazy loading.
export async function getChainAdapter(chain: NativeChain): Promise<ChainWalletAdapter> {
  if (chain === 'evm') {
    // Lazy load the EVM adapter at runtime using dynamic import
    const mod = await import('./evm-adapter');
    return mod.evmAdapter;
  }
  else {
    if (chain === 'base') {
      const mod = await import('./base-adapter');
      return mod.baseAdapter;
    }
  }

  const adapter = adapters[chain]
  if (!adapter) {
    // Defensive: fail fast if requested chain is not supported, avoids downstream undefined errors.
    logger.error(`No wallet adapter registered for requested chain: ${chain}.  Supported chains: ${Object.keys(adapters).join(', ')}`, { chain })
    throw new Error(`No wallet adapter registered for requested chain: ${chain}.  Supported chains: ${Object.keys(adapters).join(', ')}`)
  }
  return adapter
}