import 'server-only'

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { ChainWalletAdapter } from './types'

export const evmAdapter: ChainWalletAdapter = {
  chain: 'evm',
  label: 'Ring Wallet (EVM)',

  async generate() {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    return {
      chain: 'evm',
      address: account.address,
      secret: privateKey,
      label: 'Ring Wallet (EVM)',
    }
  },
}
