# Ring PublicPool — Solana Anchor program (v2 escrow)

Status: **scaffold / not deployed**. v1 docs backlog uses **donation** chip-ins to the clone treasury ATA with off-chain pool accounting in Postgres.

## Purpose

Conditional RING contributions for `public_pools` with `funding_mode: escrow`:

- Contributors deposit SPL RING into a **PDA vault** tied to `pool_slug`
- If `raised >= goal` before `deadline` → `finalize_success` releases to builder/treasury
- If deadline passes under goal → contributors call `refund_contributor`

## Instructions (planned)

| Instruction | Description |
|-------------|-------------|
| `init_pool` | Create pool account: goal, deadline, clone_id hash, pool_slug hash |
| `contribute` | SPL transfer checked into vault; emit contribution index |
| `finalize_success` | Authority or crank when raised ≥ goal; transfer vault → recipient |
| `refund_contributor` | After deadline if under goal; return contributor share |

## Account layout (sketch)

```rust
// programs/public-pool/src/state.rs (to implement)
pub struct PublicPoolState {
    pub clone_id_hash: [u8; 32],
    pub pool_slug_hash: [u8; 32],
    pub goal_amount: u64,
    pub raised_amount: u64,
    pub deadline_unix: i64,
    pub status: u8, // Open | Finalized | Refunding
    pub bump: u8,
}
```

## Postgres sync

On program events, indexer or cron updates:

- `public_pools.data.on_chain` → `{ program_id, pool_pda, vault_ata }`
- `public_pool_contributions.status` → `confirmed` | `refunded`

## Gate separation

**Off-chain (Postgres):** 100 likes OR 100% pledged → `status: queued` for build prioritization.

**On-chain (program):** Financial goal + deadline only — do not duplicate like quorum on-chain.

## Devnet checklist

1. Deploy program to devnet
2. Set `NEXT_PUBLIC_PUBLIC_POOL_PROGRAM_ID` in clone env
3. Enable `funding_mode: escrow` in widget when program is live
4. Wire `PublicPoolEscrowNotAvailableError` removal in contribute service

## References

- Existing SPL paths: `features/wallet/chains/solana/ring-transfer.ts`, `treasury-transfer-service.ts`
- Service stub: `features/public-pools/services/public-pool-contribute.ts` throws until program ships
