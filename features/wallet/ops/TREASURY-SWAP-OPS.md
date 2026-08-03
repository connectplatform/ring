# Wagmi Treasury Swap — ops notes (Ring Platform)

## Hybrid settle (EVM in → Solana out)

When `chains.native = "solana"` (current ring-platform.org):

1. User sends allowlisted ERC-20 (USDC/USDT) from MetaMask → `chains.evm.treasuryAddress` (Polygon).
2. Server verifies Transfer receipt, then pays **SPL RING** from Solana treasury to custodial wallet via `transferTokenFromTreasury`.
3. Ops must keep: Polygon treasury funded for inbound stables **and** Solana treasury funded for RING out.

## Client treasury visibility

`getClientEvmTreasuryAddress()` reads:

1. `ring-config.json` → `chains.evm.treasuryAddress`
2. `NEXT_PUBLIC_EVM_TREASURY_ADDRESS`

Server also accepts `EVM_TREASURY_ADDRESS`.

### Steps to resolve soft-gates

1. Choose Polygon treasury hot wallet (receives USDC/USDT).
2. Set `chains.evm.treasuryAddress` in ring-config.json (deployed value).
3. Set `NEXT_PUBLIC_EVM_TREASURY_ADDRESS` in env / k8s so client UI can gate Swap CTA.
4. Set server `EVM_TREASURY_ADDRESS` to the same address if config lag.
5. Redeploy app so public env is baked into client bundle.
6. Verify `/wallet` Swap CTA + `/wallet/topup` Other wallet no longer show “treasury missing”.

## Diversify readiness

Allowlist now includes **USDC + USDT** (both with Chainlink feeds) so `allowlist ≥ 2` can pass.

### Manual ops

1. Confirm Chainlink feeds return non-stale prices on Polygon (USDC/USDT).
2. Fund treasury with both tokens (non-zero balances) for a meaningful plan.
3. Open Admin → Web3 → Diversify; button enables when `getTreasuryDiversifyHealth().ready`.
4. Click **Run diversify plan** → records equal-weight USD plan (`plan_only` until router).
5. Auto DEX exec requires `EVM_TREASURY_SWAP_ROUTER` + security audit — do **not** enable in prod without auditor.

## RingTreasurySwap deploy (Amoy / Polygon testnet)

```bash
cd /Users/insight/code/ringdom/ring-platform.org/contracts
npm run compile
TREASURY_ADDRESS=0xYourTreasury DEPLOYER_PRIVATE_KEY=0x… \
  npx hardhat run scripts/deploy-treasury-swap.js --network amoy
```

Then owner-call `setTokenAllowlisted` for each allowlist token. Audit before mainnet.

## Amount API consistency (raw vs UI)

### Current

- Solana path / `WalletConductor.transferNative`: **raw** integer string.
- `transferEvmTokens`: **UI** decimal string (`parseUnits`).
- Facade `transferNativeTokenForUser` bridges raw→UI for EVM.

### Steps to unify on `amountRaw`

1. Add `transferEvmTokensRaw({ senderWallet, toAddress, amountRaw: bigint })` (or string) next to UI helper.
2. Change `transferEvmTokens` callers to raw OR mark UI helper `@deprecated` for custodial send.
3. Update `transferNativeTokenForUser` to call raw EVM helper (drop formatUnits bridge).
4. Grep all `transferEvmTokens(` call sites; migrate.
5. Document in AI-CONTEXT: “all custodial native sends use amountRaw”.
6. Add a small unit test: 1.5 RING UI → raw → round-trip on both chains.

## Task escrow (native out = desk treasury)

Chat **task escrow** reuses the same Solana desk treasury + fee-payer keys as wallet buy (`transferTokenFromTreasury` / `SOLANA_TREASURY_PRIVATE_KEY` + `SOLANA_FEE_PAYER_PRIVATE_KEY`). No separate task treasury.

- **Release (accept):** treasury → assignee; if transfer unavailable → credit equivalent (`desk_sell`, `fallback: credit_equivalent`).
- **Refund (cancel):** treasury → reporter; if transfer unavailable → credit equivalent (`desk_refund`, same fallback) — escrow stays `refunded` (true CAS claim is not reverted).
- Ops: keep desk buy healthy first; missing custodial wallet or mainnet hot-key block will force the credit fallback.
- Docs: `docs/en/features/tasks.mdx` (escrow CAS + rails).
