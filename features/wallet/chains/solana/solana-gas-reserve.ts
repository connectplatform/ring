import 'server-only'

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getFeePayerKeypair, getSolanaConnection } from './solana-client'

export class GasReserveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GasReserveError'
  }
}

const DEFAULT_MIN_SOL = 0.05

export function getMinSolReserve(): number {
  const raw = process.env.SOLANA_FEE_PAYER_MIN_SOL
  if (!raw) return DEFAULT_MIN_SOL
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_SOL
}

export async function getFeePayerSolBalance(): Promise<{
  address: string
  lamports: number
  sol: number
  minSol: number
  healthy: boolean
}> {
  const feePayer = getFeePayerKeypair()
  const connection = getSolanaConnection()
  const lamports = await connection.getBalance(feePayer.publicKey)
  const sol = lamports / LAMPORTS_PER_SOL
  const minSol = getMinSolReserve()

  return {
    address: feePayer.publicKey.toBase58(),
    lamports,
    sol,
    minSol,
    healthy: sol >= minSol,
  }
}

export async function assertFeePayerGasReserve(tokenSymbol = 'RING'): Promise<void> {
  try {
    const reserve = await getFeePayerSolBalance()
    if (!reserve.healthy) {
      throw new GasReserveError(
        `No more gas. Add SOL to ${reserve.address} to enable ${tokenSymbol} send`,
      )
    }
  } catch (error) {
    if (error instanceof GasReserveError) {
      throw error
    }
    if (error instanceof Error && error.message.includes('SOLANA_FEE_PAYER')) {
      throw new GasReserveError(
        'No more gas. Configure SOLANA_FEE_PAYER_PRIVATE_KEY to enable RING send on Solana.',
      )
    }
    throw error
  }
}
