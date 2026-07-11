#!/usr/bin/env node
/**
 * One-shot: point Metaplex Core collection uri at KEYS metadata JSON.
 * Avoids Next.js `server-only` — run: node scripts/update-keys-collection-uri.mjs
 */
import { readFileSync } from 'node:fs'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import {
  fetchCollection,
  mplCore,
  updateCollection,
} from '@metaplex-foundation/mpl-core'
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from '@metaplex-foundation/umi'
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

function loadEnvLocal() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (!(k in process.env)) process.env[k] = v
    }
  } catch {
    /* optional */
  }
}

function feePayerKeypair() {
  const key = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY
  if (!key) throw new Error('SOLANA_FEE_PAYER_PRIVATE_KEY not set')
  try {
    return Keypair.fromSecretKey(bs58.decode(key))
  } catch {
    const arr = JSON.parse(key)
    return Keypair.fromSecretKey(Uint8Array.from(arr))
  }
}

loadEnvLocal()

const COLLECTION =
  process.env.NFT_COLLECTION_MINT ||
  'ABKoCh2U6jf9952wh1QygMiazrod3vQNvuwMVYSVwTgw'
const URI =
  process.env.NFT_COLLECTION_URI ||
  'https://gist.githubusercontent.com/connectplatform/f0159d5ffe6c80089f3aa240dd8e0193/raw/collection.json'
const NAME = process.env.NFT_COLLECTION_NAME || 'Ringdom Keys Collection'
const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

const umi = createUmi(RPC).use(mplCore())
const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(feePayerKeypair()))
umi.use(signerIdentity(signer, true))

const collection = publicKey(COLLECTION)
const onChain = await fetchCollection(umi, collection)
const authority = onChain.updateAuthority?.toString?.() ?? String(onChain.updateAuthority)
const identity = umi.identity.publicKey.toString()

console.log(
  JSON.stringify(
    {
      collection: COLLECTION,
      name: onChain.name,
      currentUri: onChain.uri,
      updateAuthority: authority,
      sponsor: identity,
      nextName: NAME,
      nextUri: URI,
    },
    null,
    2,
  ),
)

if (authority !== identity) {
  console.error(
    `Authority mismatch: collection ${authority} ≠ sponsor ${identity}. Recreate collection.`,
  )
  process.exit(1)
}

const tx = await updateCollection(umi, {
  collection,
  name: NAME.slice(0, 32),
  uri: URI,
}).sendAndConfirm(umi)

const { base58 } = await import('@metaplex-foundation/umi/serializers')
const signature = base58.deserialize(tx.signature)[0]
console.log(JSON.stringify({ success: true, signature, uri: URI, name: NAME }, null, 2))
