import 'server-only'

/**
 * TD-MONEY-03 — Escrow program gate.
 * A separate Solana Anchor program (programs/public-pool) must be launched;
 * this helper only detects env readiness.
 */
export function getPublicPoolProgramId(): string | null {
  const id =
    process.env.NEXT_PUBLIC_PUBLIC_POOL_PROGRAM_ID?.trim() ||
    process.env.PUBLIC_POOL_PROGRAM_ID?.trim() ||
    ''
  return id || null
}

export function isPublicPoolEscrowDeployed(): boolean {
  return Boolean(getPublicPoolProgramId())
}

export function publicPoolEscrowNotReadyMessage(): string {
  if (!isPublicPoolEscrowDeployed()) {
    return (
      'Escrow chip-ins require the Solana PublicPool program. ' +
      'Deploy solana/programs/public-pool (see programs/public-pool/README.md), ' +
      'then set NEXT_PUBLIC_PUBLIC_POOL_PROGRAM_ID.'
    )
  }
  return (
    'PublicPool program id is set. Ensure init_pool ran for this jar and ' +
    'on_chain { pool_pda, vault_ata } is stored before escrow contribute.'
  )
}
