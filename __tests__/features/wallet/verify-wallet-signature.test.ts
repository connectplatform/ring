import { privateKeyToAccount } from 'viem/accounts'
import {
  normalizeWalletStorageId,
  toChecksumAddress,
  verifyWalletNonceSignature,
} from '@/features/wallet/services/verify-wallet-signature'

const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

describe('verify-wallet-signature', () => {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY)

  it('normalizes storage ids to lowercase', () => {
    expect(normalizeWalletStorageId(account.address)).toBe(account.address.toLowerCase())
  })

  it('checksums addresses', () => {
    expect(toChecksumAddress(account.address.toLowerCase())).toBe(account.address)
  })

  it('verifies a valid nonce signature', async () => {
    const nonce = 'test-nonce-abc123'
    const signature = await account.signMessage({ message: nonce })

    await expect(
      verifyWalletNonceSignature({
        walletAddress: account.address,
        nonce,
        signature,
      }),
    ).resolves.toBe(true)
  })

  it('rejects an invalid signature', async () => {
    await expect(
      verifyWalletNonceSignature({
        walletAddress: account.address,
        nonce: 'expected-nonce',
        signature:
          '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
      }),
    ).resolves.toBe(false)
  })
})
