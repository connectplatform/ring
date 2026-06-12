# Referral On-Chain Ops Runbook (Emperor-keyed)

Activates real token mints for the refcodes module. All signing steps require
private keys — execute manually. Code paths are already wired and smoke-tested
(15/15); mints no-op with "not configured" until these env vars are set.

## 1. Prepare wallets

| Wallet | Purpose | Env var |
|--------|---------|---------|
| Deployer | Deploys ReferralRewards proxy, becomes `DEFAULT_ADMIN_ROLE` | `DEPLOYER_PRIVATE_KEY` (deploy only) |
| Operator | Server-side minter, calls `payReferral` | `REFERRAL_MINTER_PRIVATE_KEY` (runtime) |

Fund both with POL for gas on Polygon mainnet (operator needs ongoing gas).

## 2. Deploy ReferralRewards (UUPS proxy)

```bash
cd contracts
rm -rf node_modules package-lock.json && npm install   # ethers v6 stack
REFERRAL_REWARD_TOKEN_ADDRESS=0x<RewardToken> \
REFERRAL_MINTER_ADDRESS=0x<OperatorAddress> \
REFERRAL_REWARD_MODE=0 \
DEPLOYER_PRIVATE_KEY=0x<DeployerKey> \
npx hardhat run scripts/deploy-referral-rewards.js --network polygon
```

Output prints the **proxy** and implementation addresses; a JSON record lands
in `contracts/deployments/`. Save the proxy address.

## 3. Grant mint permission to the proxy (MINT mode)

The reward token must authorize the **proxy** (not the operator):

| Token type | Action (token owner signs) |
|------------|---------------------------|
| Ownable `mint` | `token.transferOwnership(<proxy>)` |
| OZ AccessControl | `token.grantRole(await token.MINTER_ROLE(), <proxy>)` |

Hardhat console one-liner (AccessControl):

```bash
npx hardhat console --network polygon
> const t = await ethers.getContractAt('IAccessControl', '0x<RewardToken>')
> await t.grantRole(await (await ethers.getContractAt(['function MINTER_ROLE() view returns (bytes32)'], '0x<RewardToken>')).MINTER_ROLE(), '0x<Proxy>')
```

TRANSFER mode (`REFERRAL_REWARD_MODE=1`) instead: fund the proxy with reward
tokens from the treasury; no role grant needed.

## 4. Runtime env (per environment)

`.env.local` (dev) and `k8s/secrets.yaml` → `ring-platform-org-secrets` (prod):

```bash
REFERRAL_MINTER_PRIVATE_KEY=0x...       # operator wallet
REFERRAL_REWARDS_ADDRESS=0x...          # proxy from step 2
REFERRAL_REWARD_TOKEN_ADDRESS=0x...     # reward ERC20
CRON_SECRET=$(openssl rand -hex 24)     # /api/cron/refcodes-mint is 401 until set
POLYGON_RPC_URL=https://polygon-rpc.com # or a dedicated RPC
```

Prod apply (k3s-or):

```bash
kctl k3s-or -n ring-platform-org create secret generic ring-platform-org-secrets \
  --from-literal=REFERRAL_MINTER_PRIVATE_KEY=... \
  --dry-run=client -o yaml | kctl k3s-or apply -f -
kctl k3s-or -n ring-platform-org rollout restart deploy/ring-platform-org
```

## 5. Verify

```bash
# Cron (expects {"success":true,...} after env set)
curl -H "Authorization: Bearer $CRON_SECRET" https://ring-platform.org/api/cron/refcodes-mint

# Then: admin /admin/refcodes → approve a pending reward → status minted + txHash
# Referrer receives a `referral_reward_minted` notification.
```

## 6. Optional: on-chain vendor payouts

Separate rail (`SETTLEMENT_PAYOUT_MODE=onchain`) needs
`SETTLEMENT_PAYOUT_PRIVATE_KEY` + `SETTLEMENT_PAYOUT_TOKEN_ADDRESS`.
Leave `simulated` until treasury policy is decided — settlements show a
"Simulated" badge meanwhile.

## Schedule the mint cron (prod)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: refcodes-mint
  namespace: ring-platform-org
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: curl
              image: curlimages/curl:8.7.1
              args:
                - -fsS
                - -H
                - "Authorization: Bearer $(CRON_SECRET)"
                - http://ring-platform-org.ring-platform-org.svc.cluster.local:3000/api/cron/refcodes-mint
              env:
                - name: CRON_SECRET
                  valueFrom:
                    secretKeyRef:
                      name: ring-platform-org-secrets
                      key: CRON_SECRET
          restartPolicy: OnFailure
```
