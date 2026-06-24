import 'server-only'

import { getNativeChain } from '@/lib/ring-config-chain'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { getEvmRingBalance, transferEvmRing } from './evm/ring-transfer'
import { getSolanaRingBalance, transferSolanaRing } from './solana/ring-transfer'

export async function getRingBalanceForUser(userId: string): Promise<{
  balance: string
  address: string
  chain: 'solana' | 'evm'
  symbol: string
}> {
  const chain = getNativeChain()
  const wallet = await getNativeWallet(userId, chain)

  if (!wallet) {
    throw new Error('User wallet not found')
  }

  const balance =
    chain === 'solana'
      ? await getSolanaRingBalance(wallet.address)
      : await getEvmRingBalance(wallet.address)

  return {
    balance,
    address: wallet.address,
    chain,
    symbol: 'RING',
  }
}

export async function transferRingForUser(params: {
  userId: string
  toAddress: string
  amount: string
}): Promise<{ txHash: string; fromAddress: string; chain: 'solana' | 'evm' }> {
  const chain = getNativeChain()
  const wallet = await getNativeWallet(params.userId, chain)

  if (!wallet) {
    throw new Error('User wallet not found')
  }

  if (chain === 'solana') {
    const result = await transferSolanaRing({
      senderWallet: wallet,
      toAddress: params.toAddress,
      amount: params.amount,
    })
    return { ...result, chain }
  }

  const result = await transferEvmRing({
    senderWallet: wallet,
    toAddress: params.toAddress,
    amount: params.amount,
  })
  return { ...result, chain }
}
