export interface RingchainConfig {
  type: 'client-based'
  consensus: 'proof-of-value'
  gas: 0
  nodes: 'global'
  orchestrator: string
  governance: 'DAO'
}

export function isEnabled(): boolean {
  return process.env.RINGCHAIN_ENABLED === '1'
}

export async function submitProof(_opportunityId: string, _payload: any): Promise<void> {
  if (!isEnabled()) return
  // TODO: integrate when ready
}


