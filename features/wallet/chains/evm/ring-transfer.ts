import 'server-only'

import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { Wallet } from '@/features/auth/types'
import { getPolygonRpcUrl } from '@/lib/web3/polygon-rpc'
import { decryptUserWalletPrivateKey } from '@/lib/wallet/decrypt-user-wallet'
import { getRingTokenDecimals, getRingTokenMintOrAddress } from '@/lib/ring-config-chain'

function getTokenAddress(): Address {
  const addr = getRingTokenMintOrAddress('evm')
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    throw new Error('RING token address not configured')
  }
  return addr as Address
}

function getPublicClient() {
  return createPublicClient({
    chain: polygon,
    transport: http(getPolygonRpcUrl()),
  })
}

export async function getEvmRingBalance(walletAddress: string): Promise<string> {
  const token = getTokenAddress()
  const client = getPublicClient()
  const decimals = getRingTokenDecimals('evm')

  const result = await client.call({
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress as Address],
    }),
  })

  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: 'balanceOf',
    data: result.data ?? '0x0',
  })

  return formatUnits(balance as bigint, decimals)
}

export async function transferEvmRing(params: {
  senderWallet: Wallet
  toAddress: string
  amount: string
}): Promise<{ txHash: string; fromAddress: string }> {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  const token = getTokenAddress()
  const decimals = getRingTokenDecimals('evm')
  const value = parseUnits(params.amount, decimals)

  const privateKey = decryptUserWalletPrivateKey(
    params.senderWallet.encryptedPrivateKey,
    encryptionKey,
  )
  const account = privateKeyToAccount(privateKey)

  if (account.address.toLowerCase() !== params.senderWallet.address.toLowerCase()) {
    throw new Error('Wallet integrity check failed')
  }

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(getPolygonRpcUrl()),
  })

  const publicClient = getPublicClient()

  const hash = await walletClient.sendTransaction({
    account,
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [params.toAddress as Address, value],
    }),
  } as never)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed on-chain')
  }

  return { txHash: hash, fromAddress: params.senderWallet.address }
}
