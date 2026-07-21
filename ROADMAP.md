# Ring Platform Development Roadmap

## CURRENT STATUS OVERVIEW

**Last Updated**: July 21, 2026  
**Ring Platform Version**: **1.97.6**  
**Ringdom Ecosystem**: Open-source core of [Ringdom](https://ringdom.org) — turnkey K8s + MCP ringization for settlers  
**Live changelog**: [ring-platform.org/changelog](https://ring-platform.org/changelog)

### Critical Progress Summary

#### COMPLETED MAJOR FEATURES (recent → foundational)

**v1.97.x (July 2026)**
- Changelog locale JSON SSOT + DaVinci-glass UI; GFM / TTFB fixes
- **Ring Mailer** — first-party SMTP (`lib/mailer.ts`); Resend removed
- Owner project CRM lab (`/my-orders`, `/my-jobs`), admin `/admin/crm/*`
- Generative media; mood player; public `/{username}/player`
- PayPal payment lane; PaymentConductor expansion
- DE/ES locales; admin supermenu; NFT market media / art-generate
- Rewards admin; calculator checkout; store promotions
- **File Cabinet** foundation — `/profile/cabinet`, `/profile/shared`, `/profile/gallery`, public `/{username}/img`

**v1.6.x (June 2026)**
- Store product AI chat + SSE; ring-db `*Doc`; docs path flatten
- PaymentConductor v1; News Kingdom; scientific editor; locale SSOT
- OSS public boundary (`install.sh`, no k8s/cli in community tree)

**Earlier (2025–2026)**
- Next.js 16 + React 19 (RSC, useActionState, React Compiler, …)
- Tunnel Protocol; AI Matcher; multi-vendor store; white-label clones
- RING / native token wallet; staking; NFT gates; messaging stack
- Email AI CRM pipeline; PIN security; DatabaseService / *Doc
- Legiox skillsets + MCP orchestration (Ringdom / Cursor plugin layer)

#### IN PROGRESS
- **File Cabinet depth** — nested folders, owner ContactPicker share UX polish, shared FileTree UI parity with wiki
- **Docs locale parity** — residual UK/RU/ES/DE gaps in long MDX bodies ([scripts/LOCALE-GAPS.md](scripts/LOCALE-GAPS.md) when present)
- **Search depth** — broader full-text + Matcher coverage across verticals
- **Serialization Logic Hardening — Phase 2** — adapter-boundary ISO, serializer consolidation, type detox

#### PLANNED NEXT PRIORITIES
- Ring Academy (developer certification / cloning tutorials)
- Full DAO governance UX (on-chain voting beyond admin surfaces)
- Native mobile app (React Native / Expo)
- Additional locales (FR, PT, SW, …)
- Deeper Connect Platform DTO promotion

**No longer accurate as “TODO” (shipped):**
- Messaging frontend (list / thread / composer) — **Implemented**
- NFT marketplace module — **Implemented** (`features/nft-market`)
- NFT token gate paths — **Implemented** (`features/nft-gates`)
- Spanish / German packs — **Implemented** (es, de)
- AI-powered opportunity matching — **Implemented** (depth varies by deploy)

### Technology Stack

| Area | Current |
|------|---------|
| Framework | Next.js **16.2** (Turbopack, App Router, proxy) + React **19.2** |
| Language | TypeScript **6** |
| Auth | Auth.js v5 — Google, Apple, MetaMask, Ring Mailer (OTP / magic / password), PIN |
| Database | PostgreSQL primary · Firebase / Connect adapters · ring-db `*Doc` |
| Styling | Tailwind **4.3** + Radix UI |
| Web3 | **wagmi 3** · viem · Solana + EVM · NFT gate/market · staking |
| Payments | PaymentConductor — WayForPay, Stripe, PayPal, credit, wallet |
| Real-time | Tunnel (SSE / WebSocket / polling adapters) + FCM |
| i18n | next-intl — **en, uk, ru, es, de** |
| AI | Matcher + LLM clients; DAGI agents; Legiox MCP (settler / IDE) |

### Current Scale (2026-07-21)

- **~300** API route handlers · **~165** App Router pages · **41** `features/` modules
- Production clones include ring-platform.org, ringdom.org, greenfood.live, vikka.ua, zemna.ai, ring.ck.ua, and others
- Public OSS: community install scripts; empire k8s/cli stay out of tree

---

## RECENT MAJOR ACHIEVEMENTS

### v1.97.6 / 1.97.5 — Changelog UI (COMPLETE — July 21, 2026)

- Locale `docs/{locale}/changelog.json` SSOT; static GFM; `force-static` prerender
- Shared prose tokens; math `DiagramViewer` fullscreen / Copy LaTeX
- Root `CHANGELOG.md` deprecated for UI (still may exist for git history)

### v1.97.4 — Ring Mailer (COMPLETE — July 18, 2026)

- `lib/mailer.ts` SSOT for auth email; CRM outbound remains channel SMTP under `features/email-crm/pipeline/`
- Migration `038_email_login_tokens.sql`; Credentials providers without Resend

### v1.97.3 — CRM Lab, Media, PayPal, Locales (COMPLETE — July 17, 2026)

- Owner project orders / jobs; admin CRM rename; generative media; mood player
- PayPal handlers; PaymentConductor expansion; DE/ES; admin supermenu; NFT market media

### v1.6.4 — Messenger AI, ring-db `*Doc`, Docs Flatten (COMPLETE — June 13, 2026)

- Product agent chat + SSE; domain `*Doc` API; docs at `docs/{locale}/**`

### Serialization Logic Hardening — Phase A/B (COMPLETE — June 8, 2026)

- Build-green Phase A/B; Phase 2 remains planned (see IN PROGRESS)

### Earlier milestones

Historical sections below (Database Abstraction, Kubernetes clones, Tunnel, RING economy, Auth.js, etc.) remain valid as shipped foundation. Prefer this overview + [FEATURESET.md](FEATURESET.md) + live changelog for “what is current.”

---

## Code placement note (2026-07-21)

- Email AI CRM **pipeline** → `features/email-crm/pipeline/` (was `services/email/`)
- Native token price oracle → `features/wallet/services/native-token-price-oracle.ts` (was `services/blockchain/price-oracle-service.ts`)
- Auth SMTP SSOT stays `lib/mailer.ts`

---
