import 'server-only'

import { getNativeChain, NativeChain } from '@/lib/ring-config-chain'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { getNativeTokenBalance, transferNativeToken } from './solana/native-token-transfer'

export async function getNativeTokenBalanceForUser(userId: string): Promise<{
  balance: string
  address: string
  chain: NativeChain
  tokenSymbol: ReturnType<typeof getNativeTokenSymbol>
}> {
  const chain = getNativeChain()
  const wallet = await getNativeWallet(userId, chain)

  if (!wallet) {
    throw new Error('User wallet not found')
  }

  const balance = await getNativeTokenBalance(wallet.address)

  return { balance, address: wallet.address, chain, tokenSymbol: getNativeTokenSymbol() }
}

export async function transferNativeTokenForUser(params: {
  userId: string
  toAddress: string
  amount: string
}): Promise<{ txHash: string; fromAddress: string; chain: NativeChain }> {
  const chain = getNativeChain()
  const wallet = await getNativeWallet(params.userId, chain)

  if (!wallet) {
    throw new Error('User wallet not found')
  }

  if (chain === 'solana') {
    const result = await transferNativeToken({
      senderWallet: wallet,
      toAddress: params.toAddress,
      amount: params.amount,
    })
    return { ...result, chain }
  }

  const result = await transferNativeToken({
    senderWallet: wallet,
    toAddress: params.toAddress,
    amount: params.amount,
  })
  return { ...result, chain }
}
