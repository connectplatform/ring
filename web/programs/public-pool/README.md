# Ring PublicPool — Solana Anchor program (escrow)

**Canonical source:** [`solana/programs/public-pool`](../../solana/programs/public-pool) (workspace member).  
This directory keeps the historical README pointer used by Type Debt docs.

## Do we need a separate Solana contract?

**Yes.** Escrow (`funding_mode: escrow`) uses this Anchor program (PDA vault + contribute / finalize / refund). It is distinct from:

- Donation chip-ins → clone treasury ATA (`transferTokenToTreasury`)
- Card/PayPal jar → PaymentConductor `public_pool_contribution` + desk-oracle → `pledged_native_token`
- Builder payout → treasury → opportunity-owner native wallet (pledged − platform fee)

## Emperor — manual deploy (devnet-first)

Use the **same Solana owner / fee-payer / treasury keys** already configured for this clone (`SOLANA_FEE_PAYER_PRIVATE_KEY`, `SOLANA_TREASURY_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`, mint from `ring-config` `chains.solana`).

```bash
cd ring-platform.org/solana
# Ensure ~/.config/solana/id.json (or Anchor.toml provider.wallet) is the deploy authority
solana config set --url https://api.devnet.solana.com
solana airdrop 2   # if needed for deploy rent

anchor build -p public_pool
# Note program id from target/deploy/public_pool-keypair.json
anchor keys list
# Update declare_id! + Anchor.toml [programs.devnet] to the real id, rebuild once

anchor deploy -p public_pool --provider.cluster devnet
```

Then set on the clone:

```bash
NEXT_PUBLIC_PUBLIC_POOL_PROGRAM_ID=<deployed_program_id>
```

Per escrow pool: call `init_pool` (admin/crank) with clone_id_hash + pool_slug_hash; store `{ program_id, pool_pda, vault_ata }` on `public_pools.on_chain`.

App path: `executeNativePoolContribution` uses on-chain contribute when `isPublicPoolEscrowDeployed()`; donation path unchanged.

## Platform fee (off-chain)

`publicPools.platformFeePercentByRole` in `ring-config.json` — applied on builder payout (treasury → owner wallet), not inside the program.
