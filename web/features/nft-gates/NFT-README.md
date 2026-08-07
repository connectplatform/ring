# Ring NFT Gates — Metaplex Core (MVP-A)

Solana-first gate NFTs: **Metaplex Core** mint + **GateEscrow** stake (not `NATIVE_NFT_APR`).

## Collection SSOT

| Field | Value |
|-------|--------|
| `ring-config.json` → `nft.collectionMint` | `ABKoCh2U6jf9952wh1QygMiazrod3vQNvuwMVYSVwTgw` |
| Create tx (devnet/local) | `3QNmbKprJHxa4zNXDQr9sMLENGF3HeHMRT6eJB9pPtWX1VJgVrcLhEL6CEmwqmHALRJvjVJva2NXsN4q3QqXeDkr` |
| Explorer | [Solana Explorer](https://explorer.solana.com/address/ABKoCh2U6jf9952wh1QygMiazrod3vQNvuwMVYSVwTgw) · [Metaplex Core](https://core.metaplex.com/explorer/ABKoCh2U6jf9952wh1QygMiazrod3vQNvuwMVYSVwTgw) |

Created via admin **Create Metaplex Core collection** (`/admin/nft/mint`). Sponsor fee payer signs mint SOL (`SOLANA_FEE_PAYER_PRIVATE_KEY`).

### Explorer: KEYS symbol vs RING payment

Solana Explorer **Symbol** is the NFT collection **ticker** from off-chain JSON at the collection `uri`. It is **not** the SPL token used for primary sale. Metaplex Core has **no on-chain symbol field**.

| Field | Value |
|-------|--------|
| Family name | Ringdom Keys Collection |
| `nft.collectionSymbol` | `KEYS` |
| Live on-chain `uri` (devnet) | [KEYS gist JSON](https://gist.githubusercontent.com/connectplatform/f0159d5ffe6c80089f3aa240dd8e0193/raw/collection.json) |
| App SSOT | `public/nft/gates/collection.json` (+ `collection.png`) |
| Stable path (post-deploy) | `https://ring-platform.org/nft/gates/collection.json` → rewrite → `/api/nft/gates/collection` |
| Update tx (KEYS uri) | `5AEdw5nA31bxJihZHPfzxcWHj2vcd1tNPFcZ7ymVpr4hwe61CW8XKZ1sbUBbqnw9yfPo5gC1uDZ4CXoRNfcu856X` |
| RING | Payment currency in `purchase.ts` (`transferChecked` + `priceRing`) — unrelated to Explorer Symbol |

**Why gist for now:** prod `/nft/gates/collection.json` is currently caught by the App Router profile catch-all (HTML, not JSON) until the rewrite/API route ships; RingBase CDN upload returned URLs that 404 on `cdn.ring-platform.org`. Gist is publicly fetchable with `"symbol":"KEYS"` so Explorer/DAS can index.

**On-chain update:** admin **Point collection URI → KEYS JSON** (or `node scripts/update-keys-collection-uri.mjs`) calls Metaplex Core `updateCollection` when the sponsor fee payer is still update authority. After next deploy, set `nft.collectionUri` to the stable ring-platform.org path and re-run the update. If authority was moved, recreate the collection and set `nft.collectionMint`.

“Compressed” on Explorer is Metaplex Core indexing labeling; creation used standard Core `createCollection`, not Bubblegum cNFT mint.

## Mainnet — Squads authority (required before go-live)

> **MEMO:** Before mainnet, migrate **collection update authority** from the sponsor keypair to a **Squads multisig** treasury vault. Do not leave mint/update authority on a hot server key in production.

Truth lens: `AI-LEGIOX/legiox-truth-lens/solana-metaplex-nft-ring.nodus.json` · related: `solana-squads-multisig-treasury.nodus.json`.

Checklist:

1. Create Squads vault for the clone (Ring Platform org treasury policy).
2. Transfer Metaplex Core **update authority** on collection `ABKoCh2U6jf9952wh1QygMiazrod3vQNvuwMVYSVwTgw` to the Squads vault.
3. Document vault address in clone ops runbook; restrict admin mint to Squads-approved signers.
4. Re-verify `GateResolver` RPC checks against the same `collectionMint` in ring-config.

## Local ImageConductor → prod ring-filebase

`ring-filebase-api` is **ClusterIP only** (no public upload ingress). Local `next dev` must port-forward:

```bash
export KUBECONFIG=~/.kube/clusters/k3s-or.yaml
kubectl -n ring-filebase port-forward --address 127.0.0.1 svc/ring-filebase-api 18080:80
```

`.env.local` (verified 2026-07-10):

| Var | Value |
|-----|--------|
| `RINGBASE_API_URL` | `http://127.0.0.1:18080` |
| `NEXT_PUBLIC_RINGBASE_API_URL` | `http://127.0.0.1:18080` |
| `RINGBASE_PUBLIC_URL` | `https://cdn.ring-platform.org` |
| `RINGBASE_API_TOKEN` | long-lived claim JWT from `ring-platform-org-secrets` (not expired 1h SA projected token) |
| `NEXT_PUBLIC_STORAGE_PROVIDER` | `ring_filebase` |

**Culprit for “RingBase upload failed: 500”:** `RINGBASE_API_URL=https://api.ring-platform.org` hits Next.js ingress (HTML 500/200), not the file API; plus expired Nov-2025 SA JWT.

Art preview uses xAI `/images/edits` with project favicon (`public/images/favicon.png` as `data:image/png;base64,…`) and interpolates `$projectName`, `$activeColor`, `$secondaryColor`, `$projectColor1/2` from ring-config branding.


## Code map

- `umi-client.ts` — sponsor umi (fee payer identity)
- `metaplex-core-onchain.ts` — `createCollection`, `create` (mint), `fetchAsset` verify
- `active-template-store.ts` — **db() SSOT** for `activeTemplateAsset` (`nft_active_{slug}` in `nft_gates`); never rewrite ring-config
- `gate-escrow.ts` — stake rows (on-chain escrow program TBD)
- `gate-resolver.ts` — `hasFeature` with RPC + cache
- `purchase.ts` — RING `transferChecked` then mint
- `pay-mint-refund.ts` — on mint fail after pay: treasury→user RING refund; ledger `nft_gate_purchases` (idempotent by `paySignature` / `purchaseId`)

## Active template writeback (C)

After `adminActivateTemplateAsset` succeeds:

1. Edition row in `nft_gates` (`kind: edition`)
2. Pointer upsert via `upsertActiveTemplatePointer` → `nft_active_{slug}` (`kind: active_template`)
3. Admin/public lists use `listNftGateTemplatesResolved()` to merge DB overlay onto ring-config templates

`ring-config.json` stays install defaults only.

## RING refund on mint fail (B)

`purchaseGateNft` flow:

1. `transferChecked` user → treasury
2. Persist `payment_confirmed` in `nft_gate_purchases`
3. `mintGateAsset` — on failure → `refundAfterMintFailure` (`transferTokenFromTreasury`)
4. Persist `refund_confirmed` / `refund_failed`; return both `paySignature` and `refundSignature`
5. Idempotent: existing `refundSignature` for the same purchase/pay sig is never double-sent

Requires `SOLANA_TREASURY_PRIVATE_KEY` (same as other treasury outflows). Migration: `data/migrations/030_nft_gate_purchases_schema.sql`.

## Local dev without collection

If `collectionMint` is empty, ledger-dev assets (`gate_{slug}_…`) are used when `ALLOW_LEDGER_NFT_MINT=1` or non-production. Production refuses ledger mint without that flag.
