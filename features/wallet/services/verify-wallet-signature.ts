import { getAddress, isAddress, verifyMessage } from 'viem'

export function normalizeWalletStorageId(address: string): string {
  if (!isAddress(address)) {
    throw new Error('Invalid wallet address')
  }
  return getAddress(address).toLowerCase()
}

export function toChecksumAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error('Invalid wallet address')
  }
  return getAddress(address)
}

export async function verifyWalletNonceSignature(params: {
  walletAddress: string
  nonce: string
  signature: string
}): Promise<boolean> {
  const address = toChecksumAddress(params.walletAddress)
  return verifyMessage({
    address,
    message: params.nonce,
    signature: params.signature as `0x${string}`,
  })
}
