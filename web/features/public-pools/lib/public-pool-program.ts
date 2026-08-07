import 'server-only'

import { createHash } from 'crypto'
import { PublicKey } from '@solana/web3.js'
import { getPublicPoolProgramId, isPublicPoolEscrowDeployed } from '@/features/public-pools/lib/public-pool-escrow-gate'

export const PUBLIC_POOL_SEED = Buffer.from('public_pool')
export const CONTRIB_SEED = Buffer.from('contrib')

export function hashUtf8To32(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function derivePublicPoolPda(params: {
  programId: PublicKey
  cloneId: string
  poolSlug: string
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      PUBLIC_POOL_SEED,
      hashUtf8To32(params.cloneId),
      hashUtf8To32(params.poolSlug),
    ],
    params.programId,
  )
}

export function getPublicPoolProgramPubkey(): PublicKey | null {
  const id = getPublicPoolProgramId()
  if (!id) return null
  try {
    return new PublicKey(id)
  } catch {
    return null
  }
}

/**
 * Escrow contribute is available when program id is set.
 * Instruction builders land with Anchor IDL after `anchor build`; until then
 * donation path remains the production rail.
 */
export function canExecuteOnChainEscrow(): boolean {
  return isPublicPoolEscrowDeployed() && Boolean(getPublicPoolProgramPubkey())
}
