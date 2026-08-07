use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub const GATE_ESCROW_SEED: &[u8] = b"gate-escrow";

#[program]
pub mod gate_escrow {
    use super::*;

    pub fn stake_gate(
        ctx: Context<StakeGate>,
        user_id_hash: [u8; 32],
        slug_hash: [u8; 32],
        expires_at: i64,
    ) -> Result<()> {
        // TODO(mainnet-blocker): verify Metaplex Core asset ownership, collection,
        // transferability, and slug before activating this stake.
        // TODO(mainnet-blocker): CPI to Metaplex Core must lock/escrow the asset
        // before this account is considered authoritative for entitlements.
        let stake = &mut ctx.accounts.stake;
        stake.owner = ctx.accounts.owner.key();
        stake.asset = ctx.accounts.asset.key();
        stake.collection = ctx.accounts.collection.key();
        stake.slug_hash = slug_hash;
        stake.staked_at = Clock::get()?.unix_timestamp;
        stake.expires_at = expires_at;
        stake.bump = ctx.bumps.stake;
        stake.status = GateEscrowStatus::Active;

        let _ = user_id_hash;
        Ok(())
    }

    pub fn unstake_gate(ctx: Context<UnstakeGate>, user_id_hash: [u8; 32]) -> Result<()> {
        // TODO(mainnet-blocker): CPI to Metaplex Core must release the asset back
        // to the owner before status changes from Active.
        let stake = &mut ctx.accounts.stake;
        require_keys_eq!(
            stake.owner,
            ctx.accounts.owner.key(),
            GateEscrowError::InvalidOwner
        );
        require!(
            stake.status == GateEscrowStatus::Active,
            GateEscrowError::StakeNotActive
        );

        stake.status = GateEscrowStatus::Unstaked;

        let _ = user_id_hash;
        Ok(())
    }

    pub fn force_unstake(ctx: Context<ForceUnstake>, user_id_hash: [u8; 32]) -> Result<()> {
        // TODO(mainnet-blocker): replace this signer placeholder with a Squads-held
        // upgrade/admin authority or explicit governance config before deployment.
        // TODO(mainnet-blocker): CPI to Metaplex Core must safely release or recover
        // the asset; this skeleton only records the state transition.
        let stake = &mut ctx.accounts.stake;
        require!(
            stake.status == GateEscrowStatus::Active,
            GateEscrowError::StakeNotActive
        );

        stake.status = GateEscrowStatus::ForceUnstaked;

        let _ = (&ctx.accounts.authority, user_id_hash);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(user_id_hash: [u8; 32], slug_hash: [u8; 32], expires_at: i64)]
pub struct StakeGate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Metaplex Core asset account; validated by future Core CPI.
    pub asset: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core collection account; validated by future Core CPI.
    pub collection: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + GateEscrowStake::INIT_SPACE,
        seeds = [GATE_ESCROW_SEED, user_id_hash.as_ref(), asset.key().as_ref()],
        bump
    )]
    pub stake: Account<'info, GateEscrowStake>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user_id_hash: [u8; 32])]
pub struct UnstakeGate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [GATE_ESCROW_SEED, user_id_hash.as_ref(), stake.asset.as_ref()],
        bump = stake.bump
    )]
    pub stake: Account<'info, GateEscrowStake>,
}

#[derive(Accounts)]
#[instruction(user_id_hash: [u8; 32])]
pub struct ForceUnstake<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [GATE_ESCROW_SEED, user_id_hash.as_ref(), stake.asset.as_ref()],
        bump = stake.bump
    )]
    pub stake: Account<'info, GateEscrowStake>,
}

#[account]
#[derive(InitSpace)]
pub struct GateEscrowStake {
    pub owner: Pubkey,
    pub asset: Pubkey,
    pub collection: Pubkey,
    pub slug_hash: [u8; 32],
    pub staked_at: i64,
    pub expires_at: i64,
    pub bump: u8,
    pub status: GateEscrowStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GateEscrowStatus {
    Active,
    Unstaked,
    ForceUnstaked,
}

#[error_code]
pub enum GateEscrowError {
    #[msg("The signer does not own this gate escrow stake.")]
    InvalidOwner,
    #[msg("The gate escrow stake is not active.")]
    StakeNotActive,
}
