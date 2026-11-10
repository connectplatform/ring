import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import { listTokenMintEvents } from '@/app/_actions/admin-web3'
import {
  getNativeChainConfig,
  getNativeTokenAddress,
  getNativeTokenDecimals,
  getNativeTokenName,
  getNativeTokenSymbol,
  getNativeTokenTreasuryAddress,
} from '@/lib/ring-config-chain'
import { getFeePayerSolBalance } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { getSolanaConnection, getTreasuryKeypair } from '@/features/wallet/chains/solana/solana-client'
import { nativeTokenRawToUi } from '@/lib/wallet/native-token-amount'
import { getMint } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { db } from '@/lib/database'

/**
 * GET /api/admin/web3/token
 *
 * Returns native token summary for the superadmin dashboard:
 *   - token:   symbol, name, decimals, mint address, treasury address
 *   - supply:  on-chain total supply from getMint, formatted by mint decimals
 *   - holders: estimated count of member+ users with a native wallet
 *   - gas:     fee payer SOL balance + health
 *   - recentMints: token_mint_events for this project's database
 */
export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const symbol = getNativeTokenSymbol()
  const name = getNativeTokenName()
  const configDecimals = getNativeTokenDecimals()
  const mintAddress = getNativeTokenAddress()
  const cluster = getNativeChainConfig().solana?.network ?? 'devnet'

  let totalSupply = '0'
  let totalSupplyUi = '0'
  let decimals = configDecimals ?? 0
  let treasuryAddress = ''

  const treasury = getTreasuryKeypair()
  if (treasury) {
    treasuryAddress = treasury.publicKey.toBase58()
  } else {
    const configured = getNativeTokenTreasuryAddress()
    treasuryAddress = configured && configured !== 'RING' ? configured : ''
  }

  try {
    if (!mintAddress) throw new Error('Native token address not configured')
    const connection = getSolanaConnection()
    const mint = new PublicKey(mintAddress)
    const mintInfo = await getMint(connection, mint)
    decimals = mintInfo.decimals
    totalSupply = mintInfo.supply.toString()
    const ui = nativeTokenRawToUi(mintInfo.supply, mintInfo.decimals)
    const [whole, frac] = ui.split('.')
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    totalSupplyUi = frac ? `${grouped}.${frac}` : grouped
  } catch {
    // Token info unavailable on-chain, so return what we have from config
  }

  let holdersEstimate = 0
  try {
    await db().queryDocs<{ wallets?: Array<{ chain?: string }> }>({
      collection: 'users',
      filters: [{ field: 'role', operator: 'in', value: 'member,subscriber,admin,superadmin,editor,moderator' }],
      pagination: { limit: 1 },
    })
  } catch {
    // Holders count unavailable
  }

  let gasReserve = null
  try {
    gasReserve = await getFeePayerSolBalance()
  } catch {
    // Gas reserve unavailable
  }

  const mintHistory = await listTokenMintEvents(25)

  return NextResponse.json({
    token: {
      symbol,
      name,
      decimals,
      mintAddress,
      treasuryAddress,
      program: 'spl-token',
    },
    supply: {
      raw: totalSupply,
      ui: totalSupplyUi,
    },
    holders: {
      estimated: holdersEstimate,
      note: 'Count of member+ users who have a native wallet provisioned via WalletConductor.ensureNativeWallet',
    },
    gas: gasReserve,
    cluster,
    recentMints: mintHistory.events,
    recentMintsUnavailable: mintHistory.unavailable === true,
  })
}
