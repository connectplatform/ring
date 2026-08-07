import 'server-only'

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { ChainWalletAdapter } from '@/features/wallet/types/wallet'
import { getEvmTokenSymbol } from '@/lib/ring-config-chain'

export const evmAdapter: ChainWalletAdapter = {
  chain: 'evm',
  label: getEvmTokenSymbol(),
  getChainLabel(): string {
    return this.label
  },
  async generate() {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    return {
      chain: 'evm',
      address: account.address,
      secret: privateKey,
      label: getEvmTokenSymbol(),
    }
  },
}
