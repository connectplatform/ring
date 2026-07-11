/**
 * Umi client for Metaplex Core — sponsor feePayer as identity.
 * Reuses SOLANA_FEE_PAYER_PRIVATE_KEY + Solana RPC from solana-client SSOT.
 */

import 'server-only'

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi'
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { mplCore } from '@metaplex-foundation/mpl-core'
import { getFeePayerKeypair, getSolanaConnection } from '@/features/wallet/chains/solana/solana-client'
import { getNativeChainConfig } from '@/lib/ring-config-chain'

export function getSolanaRpcUrl(): string {
  const chains = getNativeChainConfig()
  return (
    process.env.SOLANA_RPC_URL ||
    process.env[chains.solana?.rpcUrlEnv ?? 'SOLANA_RPC_URL'] ||
    'https://api.devnet.solana.com'
  )
}

/**
 * Umi with sponsor as identity + payer (buyer need not hold SOL).
 */
export function createSponsorUmi() {
  const rpc = getSolanaRpcUrl()
  const feePayer = getFeePayerKeypair()
  // Touch connection so misconfigured RPC fails early with the same SSOT path
  getSolanaConnection()

  const umi = createUmi(rpc).use(mplCore())
  const umiKeypair = fromWeb3JsKeypair(feePayer)
  const signer = createSignerFromKeypair(umi, umiKeypair)
  umi.use(signerIdentity(signer, true))
  return umi
}
