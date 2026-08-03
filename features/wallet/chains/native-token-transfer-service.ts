import 'server-only'

/**
 * Platform-native token balance/transfer facade.
 *
 * SSOT: `getNativeChain()` ← ring-config `chains.native` (`solana` | `evm` | `base`).
 * - Solana → SPL helpers in ./solana/native-token-transfer
 * - EVM/Base → ERC-20 helpers in ./evm/evm-token-transfer (chains.evm.tokenAddress)
 *
 * Do not call Solana helpers when native is EVM (and vice versa).
 */

import {
  getNativeChain,
  getNativeTokenSymbol,
  type NativeChain,
} from '@/lib/ring-config-chain'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import {
  getNativeTokenBalance as getSolanaNativeTokenBalance,
  transferNativeToken as transferSolanaNativeToken,
} from './solana/native-token-transfer'
import {
  getEvmTokenBalance,
  transferEvmTokens,
} from './evm/evm-token-transfer'

function assertSupportedNativeChain(chain: NativeChain): void {
  if (chain !== 'solana' && chain !== 'evm' && chain !== 'base') {
    throw new Error(`Unsupported native chain: ${chain}`)
  }
}

export async function getNativeTokenBalanceForUser(userId: string): Promise<{
  balance: string
  address: string
  chain: NativeChain
  tokenSymbol: ReturnType<typeof getNativeTokenSymbol>
}> {
  const chain = getNativeChain()
  assertSupportedNativeChain(chain)

  const wallet = await getNativeWallet(userId, chain)
  if (!wallet) {
    throw new Error('User wallet not found')
  }

  const balance =
    chain === 'solana'
      ? await getSolanaNativeTokenBalance(wallet.address)
      : await getEvmTokenBalance(wallet.address)

  return { balance, address: wallet.address, chain, tokenSymbol: getNativeTokenSymbol() }
}

export async function transferNativeTokenForUser(params: {
  userId: string
  toAddress: string
  /** Raw on-chain integer amount as decimal string (not UI units). */
  amount: string
}): Promise<{ txHash: string; fromAddress: string; chain: NativeChain }> {
  const chain = getNativeChain()
  assertSupportedNativeChain(chain)

  const wallet = await getNativeWallet(params.userId, chain)
  if (!wallet) {
    throw new Error('User wallet not found')
  }

  if (chain === 'solana') {
    const result = await transferSolanaNativeToken({
      senderWallet: wallet,
      toAddress: params.toAddress,
      amount: params.amount, // raw integer string (SPL)
    })
    return { ...result, chain }
  }

  // EVM/Base: conductor always passes raw integer units; convert to UI for transferEvmTokens.
  const { formatUnits } = await import('viem')
  const { getNativeTokenDecimals } = await import('@/lib/ring-config-chain')
  const decimals = getNativeTokenDecimals(chain)
  const uiAmount = formatUnits(BigInt(params.amount), decimals)
  const result = await transferEvmTokens({
    senderWallet: wallet,
    toAddress: params.toAddress,
    amount: uiAmount,
  })
  return { ...result, fromAddress: wallet.address, chain }
}
