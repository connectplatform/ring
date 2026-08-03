//! Ring PublicPool — SPL escrow vault for `funding_mode: escrow` jars.
//!
//! PDA seeds:
//! - pool:    `[b"public_pool", clone_id_hash, pool_slug_hash]`
//! - vault:   ATA owned by pool PDA (token account)
//! - receipt: `[b"contrib", pool.key(), contributor.key()]`
//!
//! Off-chain SSOT for platform fee + desk-oracle FX lives in Next.js;
//! this program only holds/releases SPL principal.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("PooL111111111111111111111111111111111111111");

pub const PUBLIC_POOL_SEED: &[u8] = b"public_pool";
pub const CONTRIB_SEED: &[u8] = b"contrib";

#[program]
pub mod public_pool {
    use super::*;

    pub fn init_pool(
        ctx: Context<InitPool>,
        clone_id_hash: [u8; 32],
        pool_slug_hash: [u8; 32],
        goal_amount: u64,
        deadline_unix: i64,
    ) -> Result<()> {
        require!(goal_amount > 0, PublicPoolError::InvalidGoal);
        require!(
            deadline_unix > Clock::get()?.unix_timestamp,
            PublicPoolError::DeadlineInPast
        );

        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.mint = ctx.accounts.mint.key();
        pool.recipient = ctx.accounts.recipient.key();
        pool.clone_id_hash = clone_id_hash;
        pool.pool_slug_hash = pool_slug_hash;
        pool.goal_amount = goal_amount;
        pool.raised_amount = 0;
        pool.deadline_unix = deadline_unix;
        pool.status = PoolStatus::Open as u8;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        require!(amount > 0, PublicPoolError::InvalidAmount);
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open as u8, PublicPoolError::PoolNotOpen);
        require!(
            Clock::get()?.unix_timestamp <= pool.deadline_unix,
            PublicPoolError::DeadlinePassed
        );
        require_keys_eq!(pool.mint, ctx.accounts.mint.key());

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.contributor_ata.to_account_info(),
                to: ctx.accounts.vault_ata.to_account_info(),
                authority: ctx.accounts.contributor.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;

        pool.raised_amount = pool
            .raised_amount
            .checked_add(amount)
            .ok_or(PublicPoolError::Overflow)?;

        let receipt = &mut ctx.accounts.receipt;
        if receipt.contributor == Pubkey::default() {
            receipt.pool = pool.key();
            receipt.contributor = ctx.accounts.contributor.key();
            receipt.amount = amount;
            receipt.bump = ctx.bumps.receipt;
            receipt.refunded = false;
        } else {
            require!(
                !receipt.refunded,
                PublicPoolError::AlreadyRefunded
            );
            receipt.amount = receipt
                .amount
                .checked_add(amount)
                .ok_or(PublicPoolError::Overflow)?;
        }
        Ok(())
    }

    /// Release vault → recipient when raised ≥ goal (authority or crank).
    pub fn finalize_success(ctx: Context<FinalizeSuccess>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open as u8, PublicPoolError::PoolNotOpen);
        require!(
            pool.raised_amount >= pool.goal_amount,
            PublicPoolError::GoalNotMet
        );
        require_keys_eq!(pool.mint, ctx.accounts.mint.key());
        require_keys_eq!(pool.recipient, ctx.accounts.recipient.key());

        let amount = ctx.accounts.vault_ata.amount;
        require!(amount > 0, PublicPoolError::EmptyVault);

        let seeds: &[&[u8]] = &[
            PUBLIC_POOL_SEED,
            pool.clone_id_hash.as_ref(),
            pool.pool_slug_hash.as_ref(),
            &[pool.bump],
        ];
        let signer = &[seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        pool.status = PoolStatus::Finalized as u8;
        Ok(())
    }

    /// After deadline under goal — return contributor share from vault.
    pub fn refund_contributor(ctx: Context<RefundContributor>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Open as u8 || pool.status == PoolStatus::Refunding as u8,
            PublicPoolError::PoolNotRefundable
        );
        require!(
            Clock::get()?.unix_timestamp > pool.deadline_unix,
            PublicPoolError::DeadlineNotPassed
        );
        require!(
            pool.raised_amount < pool.goal_amount,
            PublicPoolError::GoalAlreadyMet
        );
        require_keys_eq!(pool.mint, ctx.accounts.mint.key());

        let receipt = &mut ctx.accounts.receipt;
        require!(!receipt.refunded, PublicPoolError::AlreadyRefunded);
        require!(receipt.amount > 0, PublicPoolError::InvalidAmount);
        require_keys_eq!(receipt.contributor, ctx.accounts.contributor.key());

        let amount = receipt.amount;
        let seeds: &[&[u8]] = &[
            PUBLIC_POOL_SEED,
            pool.clone_id_hash.as_ref(),
            pool.pool_slug_hash.as_ref(),
            &[pool.bump],
        ];
        let signer = &[seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_ata.to_account_info(),
                to: ctx.accounts.contributor_ata.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        receipt.refunded = true;
        let pool = &mut ctx.accounts.pool;
        pool.status = PoolStatus::Refunding as u8;
        pool.raised_amount = pool.raised_amount.saturating_sub(amount);
        Ok(())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PoolStatus {
    Open = 0,
    Finalized = 1,
    Refunding = 2,
}

#[account]
pub struct PublicPoolState {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub clone_id_hash: [u8; 32],
    pub pool_slug_hash: [u8; 32],
    pub goal_amount: u64,
    pub raised_amount: u64,
    pub deadline_unix: i64,
    pub status: u8,
    pub bump: u8,
}

impl PublicPoolState {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[account]
pub struct ContributionReceipt {
    pub pool: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    pub refunded: bool,
    pub bump: u8,
}

impl ContributionReceipt {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1;
}

#[derive(Accounts)]
#[instruction(clone_id_hash: [u8; 32], pool_slug_hash: [u8; 32])]
pub struct InitPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: builder / opportunity-owner native wallet (SPL destination on finalize).
    pub recipient: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = PublicPoolState::LEN,
        seeds = [PUBLIC_POOL_SEED, clone_id_hash.as_ref(), pool_slug_hash.as_ref()],
        bump
    )]
    pub pool: Account<'info, PublicPoolState>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = pool
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [PUBLIC_POOL_SEED, pool.clone_id_hash.as_ref(), pool.pool_slug_hash.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, PublicPoolState>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = contributor
    )]
    pub contributor_ata: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = contributor,
        space = ContributionReceipt::LEN,
        seeds = [CONTRIB_SEED, pool.key().as_ref(), contributor.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, ContributionReceipt>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FinalizeSuccess<'info> {
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: must match pool.recipient
    pub recipient: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [PUBLIC_POOL_SEED, pool.clone_id_hash.as_ref(), pool.pool_slug_hash.as_ref()],
        bump = pool.bump,
        has_one = authority @ PublicPoolError::InvalidAuthority
    )]
    pub pool: Account<'info, PublicPoolState>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundContributor<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [PUBLIC_POOL_SEED, pool.clone_id_hash.as_ref(), pool.pool_slug_hash.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, PublicPoolState>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = contributor
    )]
    pub contributor_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [CONTRIB_SEED, pool.key().as_ref(), contributor.key().as_ref()],
        bump = receipt.bump
    )]
    pub receipt: Account<'info, ContributionReceipt>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum PublicPoolError {
    #[msg("Goal must be > 0")]
    InvalidGoal,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Invalid contribution amount")]
    InvalidAmount,
    #[msg("Pool is not open")]
    PoolNotOpen,
    #[msg("Deadline has passed")]
    DeadlinePassed,
    #[msg("Deadline has not passed")]
    DeadlineNotPassed,
    #[msg("Goal not met")]
    GoalNotMet,
    #[msg("Goal already met — use finalize")]
    GoalAlreadyMet,
    #[msg("Vault is empty")]
    EmptyVault,
    #[msg("Pool not refundable")]
    PoolNotRefundable,
    #[msg("Contribution already refunded")]
    AlreadyRefunded,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid pool authority")]
    InvalidAuthority,
}
