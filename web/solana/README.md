# Ring NFT Exhibition Marketplace Solana Programs

Anchor scaffold for the Ring NFT Exhibition Marketplace on-chain prerequisites.

## Programs

- `programs/gate-escrow`: explicit vendor gate staking state using PDA seeds `["gate-escrow", user_id_hash, asset]`.
- `programs/gate-market`: fixed-price vendor gate listing state using PDA seeds `["gate-listing", asset]`.

## Security Boundary

Production deployment is blocked until the programs pass a mandatory Smart Contract Security Auditor review with zero critical or high findings.

Before any mainnet or production activation:

- Complete Metaplex Core CPI for asset ownership, collection verification, escrow/lock, release, and recovery.
- Complete SPL Token CPI for atomic RING `transfer_checked` settlement to seller proceeds and protocol fees.
- Move program upgrade authorities to Squads multisig.
- Move the marketplace fee recipient to a Squads-controlled vault.
- Publish audited binaries, IDLs, program IDs, and authority addresses in deployment config.

PostgreSQL listings are only an index/cache. On-chain GateMarket and GateEscrow state must be the authority for listing and entitlement state once program IDs are configured.

## Current Scaffold Gaps

The current Rust programs are intentionally skeletons. They define instruction surfaces, PDA seeds, account structs, and status transitions, but do not yet perform Metaplex Core or SPL Token CPIs.

Do not deploy these programs to mainnet. Do not enable production marketplace config from these placeholders.

## Local Build

```bash
NO_DNA=1 anchor build
```

The placeholder program IDs are local-only and must be replaced with generated program IDs before devnet deployment.
