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
import { getSharedPgPool } from '@/lib/database/shared-pg-pool'

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
  let treasuryHoldingsUi = '0'
  let treasuryHoldingsRaw = '0'
  let circulatingUi = '0'
  let circulatingRawStr = '0'

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

    // Treasury holdings (P0.3): sum treasury-owned token accounts for this mint.
    if (treasuryAddress) {
      const accounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(treasuryAddress),
        { mint },
      )
      let treasuryRaw = 0n
      for (const account of accounts.value) {
        const parsed = account.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } }
        const amountRaw = parsed?.parsed?.info?.tokenAmount?.amount
        if (typeof amountRaw === 'string' && /^\d+$/.test(amountRaw)) {
          treasuryRaw += BigInt(amountRaw)
        }
      }
      const holdingsUi = nativeTokenRawToUi(treasuryRaw, decimals)
      const [hWhole, hFrac] = holdingsUi.split('.')
      const hGrouped = hWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      treasuryHoldingsUi = hFrac ? `${hGrouped}.${hFrac}` : hGrouped
      treasuryHoldingsRaw = treasuryRaw.toString()
      try {
        if (mintInfo.supply >= treasuryRaw) {
          const circulatingRaw = mintInfo.supply - treasuryRaw
          const cUi = nativeTokenRawToUi(circulatingRaw, decimals)
          const [cWhole, cFrac] = cUi.split('.')
          const cGrouped = cWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
          circulatingUi = cFrac ? `${cGrouped}.${cFrac}` : cGrouped
          circulatingRawStr = circulatingRaw.toString()
        }
      } catch {
        // Circulating breakdown unavailable — keep zeros
      }
    }
  } catch {
    // Token info unavailable on-chain, so return what we have from config
  }

  let holdersEstimate = 0
  try {
    // P0.1: real count — users with at least one provisioned wallet
    // (custodial WalletConductor.ensureNativeWallet or connected).
    const pool = await getSharedPgPool()
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM public.users
        WHERE jsonb_typeof(COALESCE(data->'wallets', '[]'::jsonb)) = 'array'
          AND jsonb_array_length(data->'wallets') > 0`,
    )
    holdersEstimate = Number(result.rows[0]?.count ?? 0)
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
    holdings: {
      treasuryUi: treasuryHoldingsUi,
      treasuryRaw: treasuryHoldingsRaw,
      circulatingUi,
      circulatingRaw: circulatingRawStr,
    },
    holders: {
      estimated: holdersEstimate,
      note: 'Users with at least one provisioned wallet (custodial via WalletConductor.ensureNativeWallet, or connected)',
    },
    gas: gasReserve,
    cluster,
    recentMints: mintHistory.events,
    recentMintsUnavailable: mintHistory.unavailable === true,
    recentMintsUnavailableReason: mintHistory.unavailableReason ?? null,
  })
}
