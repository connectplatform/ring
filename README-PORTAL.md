# Ring Platform Portal

The public hub for the Ring ecosystem — opportunities, vendors, docs, messaging, wallet, and white-label community clones powered by the same React 19 + Next.js 16 codebase.

| Badge | Value |
|-------|-------|
| Version | 1.97.6 |
| Stack | Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · wagmi 3 |
| Site | [ring-platform.org](https://ring-platform.org) |
| Changelog | [ring-platform.org/changelog](https://ring-platform.org/changelog) |

---

## Mission

Ring Platform Portal is the community face of Ring:

- Single entry to entities, opportunities, store, news, wiki, and wallet
- AI Matcher for relevant opportunities (not noise)
- User credit + native / RING token economy with PaymentConductor (WayForPay, Stripe, PayPal, credit)
- Professional networking with confidential tiers
- Docs and customization guides for self-hosted clones
- Turnkey path via [Ringdom](https://ringdom.org) settlers (MCP / Reggie ringization)

---

## Core Surfaces

### Opportunities
- Offers and requests with AI Matcher scoring
- Ring customization / mentorship / partnership types
- Real-time feed updates via Tunnel (SSE / WebSocket)

### MVM / Vendor Store
- Multi-vendor catalog, cart, checkout
- PaymentConductor ledger; promotions and share-and-earn
- Product AI chat (Messenger + SSE)

### Wallet & Tokens
- Custodial + connected wallets
- Credit top-up, token swap paths, staking module
- NFT gates and NFT market (gallery / generative art)

### Messaging & Collaboration
- Direct messaging (list, thread, composer)
- News collaboration, amendments, TipTap editor
- Owner project CRM lab (`/my-orders`, `/my-jobs`)

### Docs & Knowledge
- MDX docs at `docs/{locale}/**` (EN/UK/RU/ES/DE packs)
- Karpathy-style wiki; file cabinet + public galleries
- Mood player: manage `/profile/songs`, public `/{username}/player`

### Networking
- Entity profiles and vertical presets
- Role hierarchy VISITOR → SUBSCRIBER → MEMBER → CONFIDENTIAL → ADMIN
- Ring Mailer auth (OTP / magic link / password) — no Resend

---

## Technical Architecture

### Frontend
```
Next.js 16 App Router + React 19 RSC
├── TypeScript 6
├── Tailwind CSS 4 + Radix UI
├── next-intl (en, uk, ru, es, de)
├── Tunnel SSE / WebSocket
└── wagmi 3 / viem / Solana + EVM adapters
```

### Backend
```
PostgreSQL-primary (Firebase / Connect adapters available)
├── ring-db *Doc domain API
├── PaymentConductor
├── AI Matcher + LLM clients
├── Email CRM pipeline (features/email-crm/pipeline)
├── Ring Mailer (lib/mailer.ts)
└── FCM + Tunnel notifications
```

### Repository layout (simplified)
```
ring-platform.org/
├── app/                 # Pages, API routes, server actions
├── features/            # Domain modules (41+)
├── lib/                 # Shared SSOT
├── docs/{locale}/       # Public docs + changelog.json
├── locales/             # i18n packs
└── data/                # schema + migrations
```

---

## Token Economics (summary)

| Asset | Role |
|-------|------|
| User credit | Platform utility balance (top-up, store, promotions) |
| Native / RING token | Governance-style + Web3 payments, staking, NFT gates |
| PaymentConductor | Unified ledger across card, PayPal, WayForPay, credit, on-chain lanes |

Exact supply / APY figures are deployment-specific — see `/docs/customization/token-economics`.

---

## Security & Access

- Auth.js v5 with role-based gates
- Rate limits, CSP, XSS sanitization
- Email CRM: multi-layer prompt-injection defenses on inbound
- OSS tree excludes k8s secrets and empire CLI (`install.sh` + env templates)

---

## Getting Started

### Users
1. Sign up (OAuth, wallet, or Ring Mailer email)
2. Complete profile / entity
3. Browse opportunities, store, news, wiki
4. Message partners; optional membership / NFT gate

### Vendors
1. Member+ vendor profile
2. List products / services
3. Checkout via PaymentConductor
4. Optional generative media and promotions

### Developers
1. `git clone` + [`install.sh`](install.sh) / [`scripts/setup-dev.sh`](scripts/setup-dev.sh)
2. Read [README.md](README.md) and `/docs`
3. White-label via env + presets; or settle on [ringdom.org](https://ringdom.org)

---

## Related

- [FEATURESET.md](FEATURESET.md) — capability inventory
- [ROADMAP.md](ROADMAP.md) — status and priorities
- [README.md](README.md) — full project README
