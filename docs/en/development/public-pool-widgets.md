# Public pool widget families

Canonical SSOT for **community jars** backed by Postgres collections `public_pools`, `public_pool_signals`, and `public_pool_contributions`. Each Ring **clone** (`ring-config.json` → `clone.name`) owns its own jars.

## Shared contract

| Collection | Purpose |
|------------|---------|
| `public_pools` | Jar metadata, goals, denormalized totals, status |
| `public_pool_signals` | 1 active like per member per pool (v1) |
| `public_pool_contributions` | Native RING chip-ins with `tx_hash` anchor |

### future_feature (implemented v1)

- **Scope:** Docs backlog `<FutureFeatureWidget />` items
- **Pricing:** 1 machine-hour = 1 RING; minimum goal = 1 RING
- **Queue gate:** 100 likes **OR** 100% RING pledged
- **Chip-in:** Native Solana RING → clone treasury (donation mode); escrow via Anchor program (planned)
- **API:** `/api/public-pools`, `/api/public-pools/signal`, `/api/public-pools/contribute`

### city_dao (planned)

Local civic jars — geo-scoped per clone.

| Subtype | Description |
|---------|-------------|
| `fix-local-issue` | Repair/maintenance (pothole, lighting, bench) |
| `improve-area` | Beautification / amenities |
| `organize-event` | Block party, cleanup, festival seed fund |

### class_action (planned)

Collective consumer/commercial jars.

| Subtype | Description |
|---------|-------------|
| `collective-purchase` | Shared buy of a product or service |
| `bulk-buy` | MOQ unlock with a vendor |
| `group-subscription` | Negotiate shared SaaS/API tier |
| `vendor-negotiation-bloc` | Pooled bid for discount or unlock |
| `shared-logistics-pool` | Combine shipping/freight costs |
| `warranty-batch-claim` | Group RMA / support escalation fund |

### mutual_aid (planned)

Solidarity pools without a vendor counterparty.

| Subtype | Description |
|---------|-------------|
| `emergency-relief` | Rapid disbursement jar |
| `member-hardship` | Anonymous member support |
| `equipment-lending-fund` | Buy/share community tools |

### governance_signal (planned)

Likes-only quorum — optional `goal_ring = 0`, no chip-in.

| Subtype | Description |
|---------|-------------|
| `policy-poll` | Clone rule change signal |
| `feature-prioritization` | Non-docs product voting |
| `trust-safety-escalation` | Community safety quorum |

## Status machine

```
open → queued → in_progress → completed
              ↘ cancelled
```

- **`queued`:** 100 likes or 100% RING (future_feature rules)
- **`completed`:** freezes `signal_at_completion` like count for display

## Admin

`POST /api/admin/public-pools/[id]/status` — platform admin status transitions.

## Escrow (v2)

See [`programs/public-pool/README.md`](../../../programs/public-pool/README.md) for the Solana Anchor PublicPool program spec (refund if goal not met by deadline).
