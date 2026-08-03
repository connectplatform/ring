# Ring Platform Development Roadmap

## CURRENT STATUS OVERVIEW

**Last Updated**: August 3, 2026  
**Ring Platform Version**: **1.97.13** (changelog blocks **1.97.6 → 1.97.13** on `/changelog`)  
**Live changelog**: [ring-platform.org/changelog](https://ring-platform.org/changelog)  
**Public roadmap UI**: [ring-platform.org/roadmap](https://ring-platform.org/roadmap) — rocket journey scrubber over live `docs/{locale}/changelog.json` (past) + `locales/*/roadmap.json` `futureMilestones` (ahead); page chrome in the same locale files.  
**Ringdom**: Turnkey K8s + MCP ringization — [ringdom.org](https://ringdom.org)

Sources reconciled from `.cursor/plans/completed/**`, production modules under `features/` + `lib/*/conductor/`, and open `.cursor/plans/*.plan.md`.

---

## COMPLETED — SHIPPED (newest clusters first)

### 1.97.6 → 1.97.13 release cluster (2026-07-24 … 2026-08-03)

| Ver | Ship |
|-----|------|
| **1.97.6** | File Cabinet depth + gallery/media hooks; mood player route reshape |
| **1.97.7** | Tasks escrow + rocket roadmap journey; docs/FEATURESET reconciliation |
| **1.97.8** | Peer Games P1 (checkers, expiry cron, FCM invite, profile games) |
| **1.97.9** | Chat interactive kit (poll/rsvp/share/product/cart + poll cron) |
| **1.97.10** | ERP Wave 1 — cart soft-holds, MCP stock, inventory-drift, DAGI, collective-order escrow |
| **1.97.11** | Email auth + Telegram Login/Stars + vitals onboarding + Wiki MVP + CRM support desk |
| **1.97.12** | Treasury swap + oracle/FX + Solana membership/public-pool programs + wallet desk |
| **1.97.13** | Order Lab clone-bridge / Forgejo source editor / `registry.ringdom.org` OCI SSOT |

### Conductor stack (SSOT orchestration)

| Conductor | Module | Role |
|-----------|--------|------|
| **PaymentConductor** | `lib/payments/conductor/` | Store, membership, news promo, wallet top-up, PayPal/Stripe/WFP/credit, native-token rail, **public-pool contributions** |
| **SubscriptionConductor** | `lib/payments/subscription/` | Membership renewals / cancel / provider status |
| **WalletConductor** | `features/wallet/conductor/` | Ensure wallet, credit spend/top-up, desk handoff, auth provisioning |
| **ProcessConductor** | `lib/processes/conductor/` | Cron / pipeline runs (`PIPELINE_IDS`) |
| **ImageConductor** | `lib/images/conductor/` | OG / editor / NFT art / MCP image generate |
| **TextConductor** | `lib/text/conductor/` | News drafts, translation, generative prompts |
| **AudioConductor** | `lib/audio/` | TTS / mood music lanes |
| **VideoConductor** | `lib/video/conductor/` | MCP video generate / remaster |
| **MediaConductor** | `lib/media/conductor/` | Scripted Image→Audio→Video orchestration |
| **NewsConductor** | `features/news/conductor/` | Article generate / translate facade over Text/Image/Audio |

Conductor mapping audit (completed): `.cursor/plans/completed/conductor_mapping_audit_3e620dce.plan.md`.

### Generative & media

- Generative media field + billing (credits via WalletConductor)
- Autonomous newsroom (Grok research → draft → OG → TTS → Telegram)
- Mood player (`/profile/songs`, public `/{username}/player`)
- Media derivatives / upload-core profiles (partial depth — see Planned)

### Commerce, wallet, Web3

- Multi-vendor store + PaymentConductor checkout (WFP / Stripe / PayPal / credit / native token)
- Settlement pipeline + affiliate / refcodes scaffolding
- NFT gates (Solana Metaplex paths) + NFT Exhibition market (member creator lane)
- Token desk / oracle-priced rails; staking module
- Wallet Connect auth (`/auth/wallet-connect`)
- **Treasury swap MVP (1.97.12)** — `RingTreasurySwap.sol` + quote/execute + FX/oracle desk
- **ERP Wave 1 (1.97.10)** — cart soft-holds, MCP store stock tools, inventory-drift, DAGI vendor agent

### DAO, collectives, public pools

- **Public pools / DAO jars** — `/dao`, admin public-pool desk, contribution settlement via PaymentConductor (`settle-public-pool-contribution`)
- Collective-need opportunity type; agricultural / ERP presets with DAO / microDAO flags
- **Chat interactive kit (1.97.9)** — poll / rsvp / share_card / product_card / cart_summary / `dao_jar` dual-gate widgets + close-expired-polls cron
- **Collective-order escrow (1.97.10)** — opportunity slot checkout + PaymentConductor handlers
- Solana program source: `membership`, `public-pool` (deploy still required)

### CRM, mail, owner lab

- Ring Mailer (`lib/mailer.ts`) — OTP / magic / password; no Resend
- Email AI CRM pipeline (`features/email-crm/pipeline/`) + support desk channels/reply (1.97.11)
- Owner project lab — `/my-orders`, `/my-jobs`, admin `/admin/crm/*`
- **Order Lab clone-bridge (1.97.13)** — Forgejo scaffold/build, source editor, env-request ownership, ringization playbook
- Calculator project-order checkout + CRM orders desk
- Admin supermenu; rewards admin; admin analytics ingestion
- **Admin Wiki MVP (1.97.11)** — `/admin/wiki` + MCP wiki tools

### Auth & onboarding

- **Email auth surface (1.97.11)** — forgot / reset / verify + email login tokens
- **Telegram Login + Stars (1.97.11)** — OIDC/widget/mini-app + Stars subscription webhook
- **Vitals onboarding (1.97.11)** — `/login/onboarding` + profile shell rebuild

### Collaboration & realtime

- Ring Messenger (list / thread / composer), group conversations foundation
- **Ring Tasks (shipped)** — first-class chat `task` messages, `/tasks` tree + `/tasks/[chatId]`, compose dialog, dual-gate widget, notifications, optional escrow (credit / WayForPay) + CRM escrow admin; services under `features/tasks/`
- **Ring Peer Games (P0+P1)** — `/games` marketplace + `game_request` chat widget, Tunnel-authoritative sessions (tic-tac-toe/chess/checkers), Member profile availability; session expiry cron, `game:*` subscribe ACL, FCM offline invite, DataChannel optimistic hints (server SSOT)
- Tunnel (SSE / WebSocket) + FCM push paths
- Contacts unification (`ring_contacts`) + ContactPicker surfaces
- News collaboration (invites, amendments, revision diffs)
- Karpathy-style wiki; **File Cabinet** foundation + depth pass (`/file-cabinet`, `/profile/cabinet|shared|gallery`, `/{username}/img`)

### Platform / DX

- Next.js 16.2 + React 19.2 + TypeScript 6 + Tailwind 4.3 + wagmi 3
- Locales **en, uk, ru, es, de**; docs flatten `docs/{locale}/**`
- ring-db `*Doc`; zero-loop proxy; Ring MCP tool surface
- **Docker registry SSOT (1.97.13)** — `registry.ringdom.org/ringdom-clones/ring`; `solana/target` + Hardhat artifacts excluded from image/git
- White-label clones on K8s (ringdom.org, greenfood, vikka, zemna, ring.ck.ua, …)

---

## IN PROGRESS (active plans / partial ship)

| Priority | Item | Plan / notes |
|----------|------|----------------|
| P0 | **File Cabinet depth** | Foundation shipped 1.97.6 — remaining nested folders polish, ContactPicker share UX, shared FileTree parity |
| P0 | **Generative Gallery SSOT** | Cabinet media hooks shipped — remaining unify NFT/store Upload\|Generate + WebP on every path |
| P0 | **DaVinci center-pane feeds** | Feed card / interactions / detail reslice |
| P0 | **Interactive money + public pool** | Program source + UI advanced 1.97.12; Solana deploy still required |
| P1 | **Messages rail upgrade** | Inbox in right rail; thread as borderless center pane |
| P1 | **Messenger Call UI** | 1:1 WebRTC on Tunnel + STUNner (invite/event polish only so far) |
| P1 | **Media derivatives** | RingBase profiles on all upload/display paths |
| P1 | **Wallet desk polish** | Token desk UX, CreditAddFsModal, safer refunds (credit-reward UX landed 1.97.12) |
| P1 | **My-Orders lab credentials** | Buyer-owned private deploy secrets (env-request spine in 1.97.13) |
| P1 | **Treasury swap production** | MVP code 1.97.12 — allowlist hardening + ops closeout |
| P1 | **Ring ERP hub Wave 2+** | Wave 1 shipped 1.97.10 — RMA/PO/lots; expansion `ring_erp_expansion_strategy_414d7d77` |
| P1 | **Intent-driven ring assembly** | Clone-bridge spine 1.97.13 — full Reggie/MCP composer product remains |
| P1 | **Solana NFT Gate production** | Source advanced — GateEscrow PDA + sponsored feePayer deploy |
| P2 | **Serialization Phase 2** | Adapter-boundary ISO, serializer consolidation |
| P2 | **Docs locale parity** | Residual UK/RU/ES/DE gaps in long MDX |
| P2 | **Matcher auto-approval toggle** | SuperAdmin settings → AI matcher |
| P2 | **ERP / affiliate ops activation** | Migrations + smoke + payout rail gating; multi-warehouse / FEFO still thin |

---

## PLANNED — SCHEDULED BACKLOG

Prioritized from open `.cursor/plans/*.plan.md` (platform-relevant). Empire-only / clone-specific ops plans stay Ringdom-internal unless noted.

### Achieved from prior backlog (moved to COMPLETED above)

- ~~Chat interactive kit completion~~ → **shipped 1.97.9**
- ~~Telegram Login (Auth.js)~~ → **shipped 1.97.11**
- ~~Ring ERP admin hub Wave 1~~ → **shipped 1.97.10** (Wave 2+ remains IN PROGRESS)
- ~~Admin Wiki MVP~~ → **shipped 1.97.11** (Obsidian-depth remains planned)
- ~~Wagmi treasury swap lane (MVP)~~ → **code shipped 1.97.12** (production hardening IN PROGRESS)
- ~~Order Lab / clone-bridge spine~~ → **shipped 1.97.13**

### Near-term (Q3 2026) — P0/P1

1. **Native token checkout hardening** — store/membership native rail polish (`.cursor/plans/native_token_checkout_b116e452.plan.md`)
2. **Treasury swap production closeout** — allowlist + ops after MVP (`.cursor/plans/ring_wagmi_swap_25d497de.plan.md`)
3. **Feed cursor SSOT** — ring-wide pagination + localStorage position (`.cursor/plans/ring-wide_feed_cursor_ssot_47218937.plan.md`)
4. **Feature shell generalization** — tiered shells + CalculatorEngine config sidebars (`.cursor/plans/feature_shell_generalization_136ae48c.plan.md`)
5. **Mobile menus refinement** — Admin vs Ring supermenu split (`.cursor/plans/mobile_menus_refinement_ce5a8cb6.plan.md`)
6. **Push notifications upgrade** — VAPID Web Push + FCM architecture split (`.cursor/plans/ring_push_notifications_upgrade_08627441.plan.md`)
7. **Contacts P5–P6** — ContactPicker in wallet send + messenger; signed RING transfer paths (`.cursor/plans/check_contacts_p5-p6_plan_32410f01.plan.md`)
8. **Ring ERP Wave 2+** — RMA/PO/lots per expansion strategy `ring_erp_expansion_strategy_414d7d77`

### Mid-term (Q4 2026) — P1/P2

11. **Ring Reward System completion** — config-driven points → credit (`.cursor/plans/ring_reward_system_acff26bb.plan.md`)
12. **Per-product referral commission** (`.cursor/plans/per-product_referral_commission_b2b48d0b.plan.md`)
13. **Admin Wiki depth** — Obsidian-like vaults, cross-tenant links (`.cursor/plans/ring_admin_wiki_12d40733.plan.md`)
14. **Ring Admin Knowledge Base** — pgvector empire brain for agents (`.cursor/plans/ring_knowledge_base_98b1d3ba.plan.md`)
15. **Tunnel remediation + native WSS prod** (`.cursor/plans/ring_tunnel_remediation_3d0da11b.plan.md`, `native_wss_prod_wiring_70f810b9.plan.md`)
16. **Postgres NOTIFY → Tunnel bridge** (`.cursor/plans/postgres_notify_tunnel_bridge_912a5508.plan.md`)
17. **RBAC service hardening** (`.cursor/plans/rbac_service_hardening_debt_f74c5754.plan.md`)
18. **API routes compliance audit remediation** (`.cursor/plans/api_routes_compliance_audit_be79f82c.plan.md`)
19. **Solana NFT Gate MVP-A production** — GateEscrow PDA, sponsored feePayer (`.cursor/plans/solana_nft_gate_mvp-a_5134b918.plan.md`)

### Horizon (2027+) — P2/P3

21. **RING token multi-chain** — Aptos Move sponsored chain of record + generalized FA rails (`.cursor/plans/check_ring_token_integration_dbc8ee91.plan.md`)
22. **Full DAO governance UX** — on-chain voting beyond pools/jars; proposal lifecycle
23. **Collective purchase protocols v2** — multi-buyer escrow, milestone releases, cooperative settlement dashboards
24. **Intent-driven ring assembly** — Reggie/MCP module composer with audit trail (Ringdom settler UX)
25. **Native mobile shell** — React Native / Expo (Messenger + wallet + opportunities first)
26. **Additional locales** — FR, PT, SW (+ RTL readiness)
27. **Ring Academy** — certification + white-label cloning curriculum
28. **Connect.Software marketplace** — MCP/skillset store vertical (`.cursor/plans/connect-software-marketplace-plan_a53443a0.plan.md`)
29. **PR-Ops / News-Ops PaaS** — automation plane for newsrooms (`.cursor/plans/pr_ops_paas_product_8d784644.plan.md`)
30. **Unified Ringdom knowledge layer** — single pgvector index over docs + AI-CONTEXT + products (`.cursor/plans/unified_ringdom_knowledge_layer_06744199.plan.md`)

### Invented modules (gaps not yet planned as files)

| Module | Intent |
|--------|--------|
| **MatchConductor** | SSOT facade over AI Matcher (score → notify → auto-approve policy) |
| **TunnelConductor** | Lifecycle for channel subscribe/publish/presence across transports |
| **SettlementConductor** | Vendor payout / affiliate / pool settlement state machine (above raw services) |
| **CloneConductor** | Settler ringization recipes → MCP command sequences with cost forecast |
| **AccessibilityConductor** | Continuous a11y audit hooks in CI + runtime axe sampling |
| **ObservabilityConductor** | Unified Web Vitals + error + funnel events → admin analytics |

---

## Technology Stack (current)

| Area | Current |
|------|---------|
| Framework | Next.js **16.2** · React **19.2** · TypeScript **6** |
| Auth | Auth.js v5 — Google, Apple, MetaMask, Ring Mailer, PIN, wallet-connect |
| DB | PostgreSQL primary · Firebase / Connect adapters · ring-db `*Doc` |
| Payments | PaymentConductor + SubscriptionConductor |
| Generative | Image / Text / Audio / Video / Media / News conductors |
| Wallet | WalletConductor · wagmi 3 · Solana + EVM |
| Realtime | Tunnel · FCM · ProcessConductor crons |
| i18n | next-intl — en, uk, ru, es, de |

### Scale (2026-07-21)

- ~300 API route handlers · ~165 App Router pages · **41** `features/` modules  
- Conductors: Payment, Subscription, Wallet, Process, Image, Text, Audio, Video, Media, News  

---

## Related

- [FEATURESET.md](FEATURESET.md) — capability inventory  
- [README.md](README.md) · [README-PORTAL.md](README-PORTAL.md)  
- [ROADMAP.uk-UA.md](ROADMAP.uk-UA.md) — Ukrainian summary  
- Locale UI copy: `locales/{en,uk,ru,es,de}/roadmap.json`  
- Completed plans archive: `.cursor/plans/completed/` (Ringdom monorepo)
