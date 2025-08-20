## Staking: Developer Guide

What it is:
- `RingStakingService` + adapters. Transactions are signed in the browser via wallet. Reads can be client or server.

Key files:
- `service.ts`: Facade over a `StakingAdapter`
- `adapters/evm.ts`: EVM implementation with approval + stake/unstake/claim, pool-aware helpers
- `staking.config.ts`: Addresses per env and builder for adapter config
- `server/read-positions.ts`: Optional RPC-based reader for caching (per-pool positions)
- `components/StakingPanel.tsx`: Minimal UI

Pools (model):
- `DAAR_APR` (token: DAAR, rewards: DAAR)
- `DAARION_APR` (token: DAARION, rewards: DAAR)
- `DAARION_DISTRIBUTOR` (token: DAARION, rewards: DAAR via fee distribution)

Adapter helpers:
- Token-centric: `stake('DAAR'|'DAARION', amount)`, `unstake(...)`, `claimRewards(...)`
- Pool-centric: `stakeByPool(pool, amount)`, `unstakeByPool(pool, amount)`, `claimByPool(pool)`

When to use server-side reads:
- If you want cached positions/APR snapshots to speed up UI and reduce RPC calls.
- If ABIs expose view functions for user info/pending rewards.
- Not required for signing or approvals (those must happen client-side via wallet).

Setup steps:
1) Provide ABIs (APR Staking, Distributor). Reuse `green-wallet-verse` ABIs.
2) Configure addresses via env or `resolveStakingAddresses` overrides.
3) Build adapter config and create `RingStakingService`.
4) Render your React UI and wire calls.

Quick start (client):
```ts
import { RingStakingService, createEvmStakingAdapter } from '@/features/staking'
import { buildEvmStakingConfig } from '@/features/staking/staking.config'
import aprStakingAbi from 'path-to/abi/aprstaking.json'
import distributorAbi from 'path-to/abi/daardistributor.json'

const adapter = createEvmStakingAdapter(
  buildEvmStakingConfig({
    getSigner: async () => {
      const { BrowserProvider } = await import('ethers')
      // @ts-ignore
      const provider = new BrowserProvider(window.ethereum)
      return provider.getSigner()
    },
    aprStakingAbi,
    feeDistributorAbi: distributorAbi
  })
)

export const stakingService = new RingStakingService(adapter)
```

UI readiness pattern:
- Disable stake/unstake/claim until initial `readPositions` completes (or server reader returns).
- Example panel already guards with input validation + in-flight state.

Security:
- Never proxy private keys. Client signs with wallet.
- Optional server reads should not expose write methods.
- Distributor claim: treated as auto-distributed by default. Only call distributor claim if ABI explicitly provides claim.
- Chain/network: validate `chainId` before sending tx; block wrong-network actions with clear UX.
- Allowances: consider zero-reset path for tokens that require it; attempt revoke-to-zero on failure; provide a "Revoke allowance" utility.

EIP-2612 (permit):
- Deferred per board decision. Standard approve+stake remains to avoid wallet-compatibility and UX inconsistencies.

Troubleshooting:
- Wrong network: prompt user to switch chain.
- Approval errors: ensure correct spender (APR Staking or Distributor address).
- Empty positions: add a `readPositions` implementation using your ABIs, or call server reader.

Testing checklist:
- Unit: allowance handling (zero-reset path), chainId guard, distributor no-op claim path.
- Integration: stake/unstake happy path, failure revocation attempt, disabled actions until loaded.
- E2E: wrong-network prevention, basic APR/distributor reads rendered, i18n messages for critical states.


