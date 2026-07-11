# Security Memo: GateEscrow and GateMarket

## Production Blocker

GateEscrow and GateMarket must not be deployed to production or mainnet until a mandatory Smart Contract Security Auditor review is complete and accepted.

Production remains blocked until:

- Smart Contract Security Auditor reports zero unresolved critical or high findings.
- Metaplex Core CPI implementation verifies collection, ownership, transferability, escrow/lock, release, and recovery behavior.
- SPL Token CPI implementation uses checked transfers for RING settlement and fee split.
- Upgrade authority is controlled by Squads multisig.
- Protocol fee recipient is a Squads-controlled vault.
- Program IDs, IDLs, binaries, and authority addresses are pinned in deployment records.

## Authority Policy

Use Squads for:

- Program upgrade authority.
- Emergency or guarded force-unstake authority.
- Marketplace protocol fee recipient or fee-vault ownership.
- Any collection authority needed by Metaplex Core integration.

No single-key production authority is acceptable.

## Mainnet TODOs

- Add explicit config accounts for governed admin/force-unstake authority.
- Add tests for wrong collection, membership rejection, stale owner, double-list, double-buy, fee rounding, cancellation, expiry, and remaining license term preservation.
- Add invariant checks proving active listing means `hasFeature:false` and active stake means `canList:false`.
- Run Anchor tests, LiteSVM or equivalent local tests, dependency scanning, and the Smart Contract Security Auditor before deployment.
