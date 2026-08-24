# Ring Platform: Feature Set

> React 19 + Next.js 16 open-source white-label platform (v1.97.17)  
> AI-Matcher, SSE tunnel, messaging, Web3 (Solana/EVM), store, CRM, wiki, file cabinet — MCP-orchestrated for any org.

---

## Platform Scale (verified 2026-07-21)


| Metric                        | Value                                                             |
| ----------------------------- | ----------------------------------------------------------------- |
| Version                       | **1.97.17**                                                       |
| Feature modules (`features/`) | **41**                                                            |
| API route handlers            | **~300**                                                          |
| App Router pages              | **~165**                                                          |
| Locales                       | **en, uk, ru, es, de** (`lib/locale-config.ts`)                   |
| Stack                         | Next.js 16.2 · React 19.2 · TypeScript 6 · Tailwind 4.3 · wagmi 3 |


## Status Legend

- **Implemented** — shipped and used in production clones
- **Partial** — works for primary paths; edge cases or verticals still open
- **Planned** — not claimed as live

Live release notes: [ring-platform.org/changelog](https://ring-platform.org/changelog) (`docs/{locale}/changelog.json`) — **99+ feature releases from 2024 genesis** (dates are narrative markers).

## Recent Highlights (newest first)



### v1.97.17 (2026-08-04)

- Share & Earn username `#tag` (hash claim + credit payout); /refcodes hero + analytics; personal-page widget / Page Builder UX



### v1.97.16 (2026-08-04)

- Docs layout FS isolation + loading/not-found locale wiring; credit `mainCurrencyRate`; opportunity main-currency filters; Order Lab share/source deep-links



### v1.97.15 (2026-08-04)

- Optional Postgres LISTEN/NOTIFY Tunnel fan-out (`TUNNEL_POSTGRES_FANOUT`, default off); live-only delivery; FCM vs VAPID keyspace docs



### v1.97.14 (2026-08-04)

- Personal page RIP3 (blocklist, NFT/media pins, private views, skills hydrate); Ring Oracle/FX cron; docs-path-url NFT-safe joins



### v1.97.13 / 1.97.5 (2026-07-21)

- Changelog page — locale JSON SSOT, DaVinci-glass cards, GFM/TTFB fixes (`force-static`)
- Shared markdown prose tokens; math viewer fullscreen / Copy LaTeX
- Order Lab clone-bridge / Forgejo source editor / registry OCI SSOT



### v1.97.4 (2026-07-18)

- **Ring Mailer** — first-party SMTP (`lib/mailer.ts`) for OTP, magic link, password reset, CRM outbound
- Auth Credentials: `email-otp` / `email-magic` / `credentials` — **no Resend**
- File Cabinet, Tasks, Peer Games — roadmap/changelog saturation



### v1.97.3 (2026-07-17)

- Owner project CRM lab (`/my-orders`, `/my-jobs`), admin CRM under `/admin/crm/*`
- Generative media, mood player (`/profile/songs`, public `/{username}/player`)
- PayPal lane + PaymentConductor expansion; DE/ES locales; admin supermenu
- NFT market media/art-generate; rewards admin; calculator checkout; store promotions



### v1.6.x (June 2026)

- Store product AI chat + SSE; ring-db `*Doc` domain API; docs path flatten
- PaymentConductor v1; News Kingdom; scientific editor; locale SSOT; OSS boundary

---



## Infrastructure

- TypeScript strict · ESLint · Jest / RTL tests · responsive + dark mode
- Accessibility baseline · loading skeletons · error boundaries · toasts · modals
- Form validation · infinite scroll · keyboard nav · code splitting
- Next Image / fonts · caching · env-driven multi-stage deploy
- Turbopack · React Compiler · App Router RSC default



## Authentication & Access

- Auth.js v5 — Google, Apple, MetaMask / wallet, Ring Mailer email (OTP / magic link / password), PIN security
- Roles: VISITOR → SUBSCRIBER → MEMBER → CONFIDENTIAL → ADMIN
- JWT sessions, rate limits, CSP / security headers
- `LoginAuthenticatedRedirect` — client session gate on `/login`



## Internationalization

- next-intl — **EN, UK, RU, ES, DE** (env: `NEXT_PUBLIC_SUPPORTED_LOCALES`)
- Modular `locales/*/modules/*` · hreflang / SEO metadata · locale-aware formatting



## Real-time Tunnel

- Multi-transport pub/sub (SSE / WebSocket / polling and provider adapters)
- Personal + topic channels; FCM push; presence / typing where messaging enables them
- Edge-compatible token auth via `/api/tunnel/token`



## Domains (Implemented)



### Entities & Opportunities

- Entity profiles, vertical presets (agricultural / ERP / platform), visibility tiers
- Dual-nature opportunities (offers / requests), AI Matcher scoring, confidential tier
- Content interactions, favorites, opportunity request APIs



### Messaging & Chat

- Direct messaging UI (conversation list, thread, composer)
- **Ring Tasks** — `/tasks` tree + `/tasks/[chatId]`, chat `task` widgets, notifications, optional escrow (credit / WayForPay)
- **Ring Peer Games** — `/games` + `/games/[slug]`, `game_request` interactive type, Member `/{username}/games`, Tunnel session SSOT (tic-tac-toe, chess, checkers); P1 ops (expiry cron, Tunnel ACL, FCM offline, DataChannel optimistic hints)
- Product / agent AI chat with SSE streaming (Anthropic / OpenAI / OpenRouter + Grok fallback)
- Lab chat rails for owner CRM



### News & Publications

- News Kingdom — promotion, Telegram approval, scoring, member blogs
- Collaboration — invites, amendments, revision diffs
- Scientific / TipTap editor — publications, versions, equations, AI assist



### Store & Commerce

- Multi-vendor catalog, cart, checkout
- PaymentConductor — WayForPay, Stripe, PayPal, internal credit, wallet top-up
- **ERP hub (P0+Wave1)** — `/admin/store` cockpit + vendor stock; `stock === available + reserved`; checkout reserves sellable `available`; paid `commitSaleForOrder`; cancel/refund restore; digital/instantDelivery skip; cart soft-holds (`cart_${userId}`); MCP `ring-stock-`*; ProcessConductor `inventory-drift`
- Store promotions, share-and-earn, product AI chat
- User credit / rewards ledger
- Vendor settlements ledger + commissions hold/release / dry-run payout



### Wallet & Web3

- Custodial + connected wallets (wagmi v3)
- Native / RING token balances, credit↔token swap paths, staking module
- Solana + EVM surfaces; NFT gates; NFT market (list / gallery / generative art)
- Price oracle: desk FX SSOT `features/wallet/services/native-token-oracle.ts`; Chainlink feeds `native-token-chainlink-oracle.ts`



### Membership & NFT Gates

- Membership manage / PayPal subscription cancel-status
- NFT-gate mint / escrow / Metaplex paths; Legiox-Access style gating patterns



### CRM & Email

- Admin CRM: inbox, drafts, contacts, tasks, analytics (`/admin/crm/*`)
- Email AI pipeline: `features/email-crm/pipeline/*` (IMAP, parse, security, AI, drafts, SMTP)
- Auth mail SSOT remains `lib/mailer.ts` (not CRM per-channel SMTP)



### File Cabinet & Media

- Personal file cabinet (`/profile/cabinet`), shared-with-me (`/profile/shared`), gallery (`/profile/gallery`)
- Public `/{username}/img`; ACL owner|editor; RingFileBase / CDN delivery
- Generative media field + gallery strip; mood player + public `/{username}/player`
- Wiki (Karpathy-style) with shared file-tree helpers



### Maps, Search, Docs

- Interactive maps (@xyflow/react) — feature / timeline / dataflow / knowledge views
- Semantic + full-text search with AI Matcher integration (**Partial** depth by vertical)
- Docs hub — `docs/{locale}/**` MDX; customization IA; changelog UI



### Admin & Ops Surfaces

- Admin supermenu (desktop/mobile)
- Rewards admin; deployment widgets in owner lab (pods / logs / restart where enabled)
- Analytics beacons; Web Vitals

---



## Web3 — Partial / Planned


| Item                                     | Status                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| EVM wallet connect + RING flows          | Implemented                                                 |
| Solana SPL paths                         | Implemented (module-dependent)                              |
| NFT market + generative art              | Implemented                                                 |
| NFT gate mint / purchase                 | Implemented                                                 |
| Multi-chain beyond configured EVM/Solana | Planned                                                     |
| Full MPC / custodial recovery UX         | Partial / Planned                                           |
| DAO on-chain voting UX                   | Partial (admin DAO surfaces exist; full governance Planned) |


---



## Planned (not claimed live)

- Native mobile app (React Native / Expo)
- Broader locale packs (FR, PT, SW, …)
- Serialization Logic Hardening Phase 2 (adapter-boundary ISO, type detox)
- Deeper Connect Platform DTO promotion
- Ring Academy certification track (Ringdom layer)

---



## Code Layout

```
features/          # Domain modules (entities, store, wallet, email-crm, file-cabinet, …)
app/               # App Router pages + API routes + server actions
lib/               # Shared SSOT (mailer, locale-config, docs, db helpers, tunnel)
docs/{locale}/     # Public documentation MDX + changelog.json
locales/           # next-intl message packs
data/              # schema.sql + migrations
```

Email inbound/CRM pipeline lives under `features/email-crm/pipeline/`.  
Native token desk FX / quotes: `features/wallet/services/native-token-oracle.ts`.  
Chainlink AggregatorV3 feeds (treasury-swap allowlist): `features/wallet/services/native-token-chainlink-oracle.ts`.

---



## Ring Mailer (2026-07)

- Own SMTP auth (OTP, magic link, password reset) via `lib/mailer.ts` — **no Resend /** `AUTH_RESEND_KEY`
- Docs: [Ring Mailer & RingdomX Mail](./docs/en/features/ring-mailer.mdx)
- Founders: calculator external `mail` → **RingdomX Mail** (hosted MX or BYO SMTP)
- Developers: set `EMAIL_MODE=ethereal` or `SMTP_*`; apply migration `038_email_login_tokens.sql`

See also [CHANGELOG.md](./CHANGELOG.md) `[1.97.4]` and [README.md](./README.md) authentication section.

---



## Related

- [README.md](README.md) — install & overview
- [ROADMAP.md](ROADMAP.md) — status & priorities
- [README-PORTAL.md](README-PORTAL.md) — portal positioning
- Changelog — [https://ring-platform.org/changelog](https://ring-platform.org/changelog)

