# Ring Membership (Anchor)

SPL subscription fee → treasury ATA + per-member subscription PDA.

## Instructions

| Ix | Purpose |
|---|---|
| `initialize` | Config PDA: mint, treasury ATA, fee_amount, period_secs |
| `create_subscription` | Transfer fee RING → treasury; init sub PDA |
| `renew_subscription` | Transfer fee; advance `next_payment_due` |
| `cancel_subscription` | Member marks cancelled / stops auto-renew |
| `set_paused` / `update_fee_config` | Authority ops |

## Wire-up (after deploy)

1. `anchor build` / deploy to **devnet**
2. Set `ring-config.json` → `chains.solana.membershipProgramId`
3. Rewrite `lib/payments/subscription/ring-membership-client.ts` off Solang selectors onto this IDL
4. Soft-launch today: empty program id → `nativeTokenSubscriptionProvider` treasury SPL

## Fee SSOT

On-chain `fee_amount` should match `membership.ring.memberUpgradeAmount` (1 RING, raw = 1e8 for 8 decimals). Off-chain display/oracle stays in `lib/membership/pricing.ts`.
