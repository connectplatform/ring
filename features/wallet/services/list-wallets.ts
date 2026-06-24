import { auth } from '@/auth'
import { selectDefaultWallet } from '@/features/wallet/services/utils'
import { getUserWallets } from '@/lib/wallet/user-wallet-db'
import { getEvmRingBalance } from '@/features/wallet/chains/evm/ring-transfer'
import { getSolanaRingBalance } from '@/features/wallet/chains/solana/ring-transfer'
import { getRingConfigSnapshot } from '@/lib/ring-config-core'
import { getRingCreditFiatCurrency } from '@/lib/ring-config-chain'

export interface WalletInfo {
  address: string
  isPrimary: boolean
  label?: string
  createdAt?: string
  balance?: string
  nativeBalance?: string
  tokenSymbol?: string
  creditFiatCurrency?: string
  chain?: 'solana' | 'evm'
}

async function fetchNativeBalance(
  address: string,
  chain: 'solana' | 'evm',
): Promise<string> {
  try {
    if (chain === 'solana') {
      return await getSolanaRingBalance(address)
    }
    return await getEvmRingBalance(address)
  } catch {
    return '0'
  }
}

/**
 * Lists custodial wallets for the authenticated user from users.wallets[].
 */
export async function listWallets(): Promise<WalletInfo[]> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Please log in to list wallets')
  }

  const userId = session.user.id
  const wallets = await getUserWallets(userId)

  if (wallets.length === 0) {
    return []
  }

  const defaultWallet = selectDefaultWallet(wallets)
  const config = getRingConfigSnapshot()
  const tokenSymbol = config.tokens?.ring?.symbol ?? 'RING'
  const creditFiatCurrency = getRingCreditFiatCurrency()

  return Promise.all(
    wallets.map(async (wallet) => {
      const chain = wallet.chain ?? 'evm'
      const nativeBalance = await fetchNativeBalance(wallet.address, chain)
      return {
        address: wallet.address,
        isPrimary: defaultWallet?.address === wallet.address,
        label: wallet.label,
        createdAt: wallet.createdAt,
        balance: wallet.balance,
        nativeBalance,
        tokenSymbol,
        creditFiatCurrency,
        chain,
      }
    }),
  )
}
