# Staking Module TODO

Status: active (alpha). EIP-2612 adoption: deferred (board decision).

Must-have (stability/security)
- Add chainId validation in adapter before tx; block wrong-network actions with clear UI.
- Implement allowance hardening:
  - Optional zero-reset path for known tokens that require it.
  - Attempt revoke-to-zero on stake failure; surface a “Revoke allowance” helper.
- Robust read integration:
  - Wire adapter `readPositions` to server reader or client ABI reads per app usage.
  - Disable pool actions until initial positions are loaded; show skeletons.
- Logging & errors: sanitize logs in prod; i18n for critical warnings (network, distributor auto-distribution).
- Distributor pool claim: keep as no-op unless ABI exposes explicit claim.

Nice-to-have (UX)
- Debounced inputs (done in `StakingPanel`); extend to full app staking UI.
- Per-pool metrics (accRewardPerShare, epoch time) in UI badges.
- “Revoke allowance” quick action per pool.

Docs
- Note distributor auto-distribution and no-claim default.
- Clarify chain/network requirements and address configuration.
- Record EIP-2612 decision and rationale (deferred) in module docs.

Testing
- Unit: adapter allowance flow, chainId guard, distributor claim no-op path.
- Integration: stake/unstake happy paths, failure revocation attempt.
- E2E: wrong-network prevention, disabled actions until positions load.


