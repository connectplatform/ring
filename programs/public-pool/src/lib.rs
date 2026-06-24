//! Ring PublicPool — escrow vault for public_pool_contributions (v2)
//!
//! See README.md for specification. Implement with Anchor 0.30+ when prioritized.

#![allow(unused)]

/// Pool PDA seeds: [b"public_pool", clone_id_hash, pool_slug_hash]
pub const PUBLIC_POOL_SEED: &[u8] = b"public_pool";

#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PoolStatus {
    Open = 0,
    Finalized = 1,
    Refunding = 2,
}

/// On-chain pool header — contributor receipts stored in separate accounts or merkle leaf.
pub struct PublicPoolState {
    pub clone_id_hash: [u8; 32],
    pub pool_slug_hash: [u8; 32],
    pub goal_amount: u64,
    pub raised_amount: u64,
    pub deadline_unix: i64,
    pub status: u8,
    pub bump: u8,
}

// TODO(anchor-escrow-v2):
// - init_pool(ctx, goal, deadline, clone_id_hash, pool_slug_hash)
// - contribute(ctx, amount)
// - finalize_success(ctx)
// - refund_contributor(ctx)
