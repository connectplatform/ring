//! Ring Membership — SPL subscription fee to treasury + on-chain subscription PDA.
//!
//! Soft-launch path (empty `membershipProgramId`) still uses sponsored treasury SPL
//! transfer in Next.js. This program is the Solana-native Membership SSOT once
//! `chains.solana.membershipProgramId` is set.
//!
//! PDA seeds:
//! - config:       `[b"membership-config"]`
//! - subscription: `[b"membership-sub", member.key()]`
//!
//! Fee amount / period are stored on Config (admin-set). Off-chain pricing SSOT
//! remains `membership.ring` in ring-config.json (1 RING monthly).

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Memb111111111111111111111111111111111111111");

pub const MEMBERSHIP_CONFIG_SEED: &[u8] = b"membership-config";
pub const MEMBERSHIP_SUB_SEED: &[u8] = b"membership-sub";

#[program]
pub mod membership {
    use super::*;

    /// Initialize membership config (authority, mint, treasury, fee, period).
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_amount: u64,
        period_secs: i64,
    ) -> Result<()> {
        require!(fee_amount > 0, MembershipError::InvalidFee);
        require!(period_secs > 0, MembershipError::InvalidPeriod);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_amount = fee_amount;
        config.period_secs = period_secs;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Pay fee_amount RING from member ATA → treasury ATA; create/activate subscription PDA.
    pub fn create_subscription(ctx: Context<CreateSubscription>) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, MembershipError::Paused);
        require_keys_eq!(config.mint, ctx.accounts.mint.key());
        require_keys_eq!(config.treasury, ctx.accounts.treasury_ata.key());

        let fee = config.fee_amount;
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.member_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.member.to_account_info(),
            },
        );
        token::transfer(cpi, fee)?;

        let now = Clock::get()?.unix_timestamp;
        let sub = &mut ctx.accounts.subscription;
        sub.member = ctx.accounts.member.key();
        sub.status = SubscriptionStatus::Active as u8;
        sub.start_time = now;
        sub.next_payment_due = now
            .checked_add(config.period_secs)
            .ok_or(MembershipError::Overflow)?;
        sub.failed_attempts = 0;
        sub.auto_renew = true;
        sub.total_paid = fee;
        sub.payments_count = 1;
        sub.bump = ctx.bumps.subscription;
        Ok(())
    }

    /// Renew: transfer fee again; advance next_payment_due.
    pub fn renew_subscription(ctx: Context<RenewSubscription>) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, MembershipError::Paused);
        require_keys_eq!(config.mint, ctx.accounts.mint.key());
        require_keys_eq!(config.treasury, ctx.accounts.treasury_ata.key());

        let sub = &mut ctx.accounts.subscription;
        require_keys_eq!(sub.member, ctx.accounts.member.key());
        require!(
            sub.status == SubscriptionStatus::Active as u8
                || sub.status == SubscriptionStatus::Grace as u8,
            MembershipError::NotRenewable
        );

        let fee = config.fee_amount;
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.member_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.member.to_account_info(),
            },
        );
        token::transfer(cpi, fee)?;

        let now = Clock::get()?.unix_timestamp;
        let base = if sub.next_payment_due > now {
            sub.next_payment_due
        } else {
            now
        };
        sub.next_payment_due = base
            .checked_add(config.period_secs)
            .ok_or(MembershipError::Overflow)?;
        sub.status = SubscriptionStatus::Active as u8;
        sub.failed_attempts = 0;
        sub.total_paid = sub
            .total_paid
            .checked_add(fee)
            .ok_or(MembershipError::Overflow)?;
        sub.payments_count = sub
            .payments_count
            .checked_add(1)
            .ok_or(MembershipError::Overflow)?;
        Ok(())
    }

    /// Member cancels auto-renew / marks cancelled.
    pub fn cancel_subscription(ctx: Context<CancelSubscription>) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        require_keys_eq!(sub.member, ctx.accounts.member.key());
        require!(
            sub.status == SubscriptionStatus::Active as u8
                || sub.status == SubscriptionStatus::Grace as u8,
            MembershipError::NotActive
        );
        sub.status = SubscriptionStatus::Cancelled as u8;
        sub.auto_renew = false;
        Ok(())
    }

    /// Authority pause/unpause.
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    /// Authority updates fee / period (keeps mint + treasury).
    pub fn update_fee_config(
        ctx: Context<UpdateFeeConfig>,
        fee_amount: u64,
        period_secs: i64,
    ) -> Result<()> {
        require!(fee_amount > 0, MembershipError::InvalidFee);
        require!(period_secs > 0, MembershipError::InvalidPeriod);
        let config = &mut ctx.accounts.config;
        config.fee_amount = fee_amount;
        config.period_secs = period_secs;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: treasury token account (ATA of platform treasury for RING mint).
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + MembershipConfig::INIT_SPACE,
        seeds = [MEMBERSHIP_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, MembershipConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSubscription<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [MEMBERSHIP_CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, MembershipConfig>,
    #[account(
        mut,
        constraint = member_ata.mint == mint.key(),
        constraint = member_ata.owner == member.key()
    )]
    pub member_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_ata.key() == config.treasury,
        constraint = treasury_ata.mint == mint.key()
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = member,
        space = 8 + MembershipSubscription::INIT_SPACE,
        seeds = [MEMBERSHIP_SUB_SEED, member.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, MembershipSubscription>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    pub member: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [MEMBERSHIP_CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, MembershipConfig>,
    #[account(
        mut,
        constraint = member_ata.mint == mint.key(),
        constraint = member_ata.owner == member.key()
    )]
    pub member_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_ata.key() == config.treasury,
        constraint = treasury_ata.mint == mint.key()
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [MEMBERSHIP_SUB_SEED, member.key().as_ref()],
        bump = subscription.bump
    )]
    pub subscription: Account<'info, MembershipSubscription>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelSubscription<'info> {
    pub member: Signer<'info>,
    #[account(
        mut,
        seeds = [MEMBERSHIP_SUB_SEED, member.key().as_ref()],
        bump = subscription.bump
    )]
    pub subscription: Account<'info, MembershipSubscription>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MEMBERSHIP_CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MembershipError::Unauthorized
    )]
    pub config: Account<'info, MembershipConfig>,
}

#[derive(Accounts)]
pub struct UpdateFeeConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MEMBERSHIP_CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MembershipError::Unauthorized
    )]
    pub config: Account<'info, MembershipConfig>,
}

#[account]
#[derive(InitSpace)]
pub struct MembershipConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub fee_amount: u64,
    pub period_secs: i64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MembershipSubscription {
    pub member: Pubkey,
    pub status: u8,
    pub start_time: i64,
    pub next_payment_due: i64,
    pub failed_attempts: u8,
    pub auto_renew: bool,
    pub total_paid: u64,
    pub payments_count: u32,
    pub bump: u8,
}

#[repr(u8)]
pub enum SubscriptionStatus {
    None = 0,
    Active = 1,
    Grace = 2,
    Cancelled = 3,
    Expired = 4,
}

#[error_code]
pub enum MembershipError {
    #[msg("Fee amount must be > 0")]
    InvalidFee,
    #[msg("Period must be > 0 seconds")]
    InvalidPeriod,
    #[msg("Membership program is paused")]
    Paused,
    #[msg("Subscription is not renewable")]
    NotRenewable,
    #[msg("Subscription is not active")]
    NotActive,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
