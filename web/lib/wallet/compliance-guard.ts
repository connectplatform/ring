import 'server-only'

import { db } from '@/lib/database'

export type ComplianceScreenResult =
  | { allowed: true }
  | { allowed: false; reasonCode: string }

const BLOCKED_ADDRESSES = new Set(
  (process.env.COMPLIANCE_BLOCKED_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean),
)

export async function logComplianceEvent(params: {
  action: string
  address: string
  userId?: string
  reasonCode?: string
  governanceRef?: string
}): Promise<void> {
  const id = `compliance_${crypto.randomUUID()}`
  await db().createDoc(
    'compliance_events',
    {
      action: params.action,
      address: params.address,
      user_id: params.userId ?? null,
      reason_code: params.reasonCode ?? null,
      governance_ref: params.governanceRef ?? null,
      created_at: new Date().toISOString(),
    },
    { id },
  )
}

/**
 * Screen wallet address before desk or airdrop settlement.
 * Devnet: env blocklist only. Phase 2.5: external OFAC API hook.
 */
export async function screenWalletAddress(
  address: string,
  userId?: string,
): Promise<ComplianceScreenResult> {
  if (!address?.trim()) {
    return { allowed: false, reasonCode: 'missing_address' }
  }

  if (BLOCKED_ADDRESSES.has(address)) {
    await logComplianceEvent({
      action: 'screen_reject',
      address,
      userId,
      reasonCode: 'blocklist',
    })
    return { allowed: false, reasonCode: 'blocklist' }
  }

  return { allowed: true }
}
