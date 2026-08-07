use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub const GATE_LISTING_SEED: &[u8] = b"gate-listing";

#[program]
pub mod gate_market {
    use super::*;

    pub fn list_gate(
        ctx: Context<ListGate>,
        slug_hash: [u8; 32],
        price_raw: u64,
        decimals: u8,
        fee_bps: u16,
        expires_at: i64,
        license_expires_at: i64,
    ) -> Result<()> {
        require!(fee_bps <= 10_000, GateMarketError::InvalidFeeBps);

        // TODO(mainnet-blocker): verify Metaplex Core collection, tradeable slug,
        // seller ownership, transferability, and unstaked GateEscrow state.
        // TODO(mainnet-blocker): CPI to Metaplex Core must escrow/lock the asset
        // before this listing may be treated as active.
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.asset = ctx.accounts.asset.key();
        listing.collection = ctx.accounts.collection.key();
        listing.slug_hash = slug_hash;
        listing.ring_mint = ctx.accounts.ring_mint.key();
        listing.price_raw = price_raw;
        listing.decimals = decimals;
        listing.fee_bps = fee_bps;
        listing.fee_recipient = ctx.accounts.fee_recipient.key();
        listing.expires_at = expires_at;
        listing.license_expires_at = license_expires_at;
        listing.bump = ctx.bumps.listing;
        listing.status = GateListingStatus::Active;

        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        // TODO(mainnet-blocker): CPI to Metaplex Core must release the escrowed
        // asset back to the seller before the listing is cancelled.
        let listing = &mut ctx.accounts.listing;
        require_keys_eq!(
            listing.seller,
            ctx.accounts.seller.key(),
            GateMarketError::InvalidSeller
        );
        require!(
            listing.status == GateListingStatus::Active,
            GateMarketError::ListingNotActive
        );

        listing.status = GateListingStatus::Cancelled;
        Ok(())
    }

    pub fn buy_listing(ctx: Context<BuyListing>) -> Result<()> {
        // TODO(mainnet-blocker): CPI to SPL Token must execute transfer_checked
        // for seller proceeds and Squads fee recipient in the same transaction.
        // TODO(mainnet-blocker): CPI to Metaplex Core must release the escrowed
        // asset to the buyer only after RING settlement succeeds atomically.
        let listing = &mut ctx.accounts.listing;
        require!(
            listing.status == GateListingStatus::Active,
            GateMarketError::ListingNotActive
        );
        require_keys_eq!(
            listing.ring_mint,
            ctx.accounts.ring_mint.key(),
            GateMarketError::InvalidRingMint
        );
        require_keys_eq!(
            listing.fee_recipient,
            ctx.accounts.fee_recipient.key(),
            GateMarketError::InvalidFeeRecipient
        );

        let _fee_amount = listing
            .price_raw
            .checked_mul(listing.fee_bps as u64)
            .and_then(|value| value.checked_div(10_000))
            .ok_or(GateMarketError::MathOverflow)?;

        listing.status = GateListingStatus::Sold;

        let _ = (
            &ctx.accounts.buyer,
            &ctx.accounts.seller_token_account,
            &ctx.accounts.fee_token_account,
            &ctx.accounts.buyer_asset_destination,
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(
    slug_hash: [u8; 32],
    price_raw: u64,
    decimals: u8,
    fee_bps: u16,
    expires_at: i64,
    license_expires_at: i64
)]
pub struct ListGate<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    /// CHECK: Metaplex Core asset account; validated by future Core CPI.
    pub asset: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core collection account; validated by future Core CPI.
    pub collection: UncheckedAccount<'info>,
    /// CHECK: RING SPL mint; validated by future SPL Token CPI.
    pub ring_mint: UncheckedAccount<'info>,
    /// CHECK: Squads-controlled protocol fee recipient; validated by config before mainnet.
    pub fee_recipient: UncheckedAccount<'info>,
    #[account(
        init,
        payer = seller,
        space = 8 + GateListing::INIT_SPACE,
        seeds = [GATE_LISTING_SEED, asset.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, GateListing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [GATE_LISTING_SEED, listing.asset.as_ref()],
        bump = listing.bump
    )]
    pub listing: Account<'info, GateListing>,
}

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [GATE_LISTING_SEED, listing.asset.as_ref()],
        bump = listing.bump
    )]
    pub listing: Account<'info, GateListing>,
    /// CHECK: RING SPL mint; checked against listing and used by future SPL Token CPI.
    pub ring_mint: UncheckedAccount<'info>,
    /// CHECK: Seller token account; validated by future SPL Token CPI.
    #[account(mut)]
    pub seller_token_account: UncheckedAccount<'info>,
    /// CHECK: Squads-controlled fee recipient owner or vault; checked against listing.
    pub fee_recipient: UncheckedAccount<'info>,
    /// CHECK: Fee token account; validated by future SPL Token CPI.
    #[account(mut)]
    pub fee_token_account: UncheckedAccount<'info>,
    /// CHECK: Buyer destination for released Core asset; validated by future Core CPI.
    #[account(mut)]
    pub buyer_asset_destination: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct GateListing {
    pub seller: Pubkey,
    pub asset: Pubkey,
    pub collection: Pubkey,
    pub slug_hash: [u8; 32],
    pub ring_mint: Pubkey,
    pub price_raw: u64,
    pub decimals: u8,
    pub fee_bps: u16,
    pub fee_recipient: Pubkey,
    pub expires_at: i64,
    pub license_expires_at: i64,
    pub bump: u8,
    pub status: GateListingStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GateListingStatus {
    Active,
    Cancelled,
    Sold,
}

#[error_code]
pub enum GateMarketError {
    #[msg("Fee basis points must be between 0 and 10000.")]
    InvalidFeeBps,
    #[msg("The signer is not the listing seller.")]
    InvalidSeller,
    #[msg("The listing is not active.")]
    ListingNotActive,
    #[msg("The provided RING mint does not match the listing.")]
    InvalidRingMint,
    #[msg("The provided fee recipient does not match the listing.")]
    InvalidFeeRecipient,
    #[msg("Checked arithmetic overflowed.")]
    MathOverflow,
}
