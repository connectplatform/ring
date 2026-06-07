# Changelog

All notable changes to Ring Platform are documented in this file.

## [1.6.1] - 2026-06-07

### Added
- **Ring MCP Service Gateway** — `/api/mcp/v1/*` bearer-token API for ring-mcp (entities, opportunities, news, store, credit, messaging, notifications, payments, users) with `lib/auth/service-token.ts` and `lib/auth/mcp-actor-context.ts`
- **Shared date serialization** — `lib/serialization/to-iso-date.ts` (`toIsoDate`, `toIsoDateOrUndefined`) for MCP and cross-boundary ISO 8601 output
- **Docs library v1.6** — New EN/UK/RU pages: locale system, Ring MCP, PaymentConductor, member blog, scientific editor, proxy/intl, self-hosted deployment, community tooling, OSS vs enterprise, news kingdom architecture, migrations getting-started
- **News seed scripts** — `scripts/seed-news-v1.6.0.sql` (+ `uk`, `ru` variants) for fresh clone content
- **MCP env template** — `RING_MCP_SERVICE_TOKENS` and synthetic service-user vars in `.env.local.template`

### Fixed
- **`auth()` TypeScript contract** — Explicit `Promise<Session | null>` return; restores `tsc --noEmit` after broken `Parameters<typeof nextAuthBase>` overload resolution
- **Next.js 16 `cacheComponents` production build** — Root Suspense fallback no longer renders route `children`; instance config loaded server-side in `app/layout.tsx` and passed into `AppClientShell` (no sync `fs` in client tree)
- **Dynamic route prerender** — `await connection()` on member blog pages and `/api/store/price-range` (replaces removed `force-dynamic`)
- **MCP route typings** — Credit history, notifications pagination, news category union, opportunity match serialization, store order status enum

### Changed
- **Version** — `1.6.0` → `1.6.1`
- **Docs navigation** — `docs-navigation-tree.tsx` aligned with expanded library structure and locale gap tracker (`docs/content/LOCALE-GAPS.md`)
- **Store PostgreSQL adapter** — Order status and query hardening in `features/store/postgresql-adapter.ts`

---

## [1.6.0] - 2026-06-06

### Added
- **PaymentConductor v1** (2026-05-22) — Config-driven payment orchestration with WayForPay + Stripe processors, `payment_transactions` ledger (migration 004), unified webhooks, internal credit rail for store orders, and thin facades for membership, store, and news promotion
- **News Kingdom upgrade** (2026-05-21) — Migrations 002–003, OpenRouter scoring, WayForPay/Stripe promotion workflow, Telegram approval callbacks, member blog routing, and kingdom-wide news branding via `lib/site-branding.ts`
- **Scientific editor + publications API** (2026-05-28) — `components/editor/*`, `app/api/publications/**`, version history, AI research assistant, equation editor; UI copy in `locales/*/editor.json`
- **Locale SSOT** (2026-05-28) — `lib/locale-config.ts` with env-driven `NEXT_PUBLIC_SUPPORTED_LOCALES` / `NEXT_PUBLIC_DEFAULT_LOCALE` for routing, SEO, preferences, and legacy browser gate
- **Member blog URLs** (2026-05-29) — `/blog/[username]/[slug]` via `lib/blog/blog-path.ts` (replaces mistaken parallel `@` route slot)
- **Content favorites API** (2026-05-29) — `app/(public)/api/user/favorites` + `useContentFavorite` for news articles
- **DaVinci mobile UX (inline)** (2026-05-29) — Glass guest auth and fullscreen menu inlined in `bottom-navigation.tsx` and `mobile-menu.tsx`; news hero + Web Share in `NewsArticleHeader`
- **Proxy-intl module** (2026-05-28) — `lib/proxy-intl.ts` shared helpers for `localePrefix: 'as-needed'` slim proxy
- **Backend modes documentation** — `docs/content/en/library/architecture/backend-modes-and-databases.mdx`
- **Push notifications FCM + Ethereum wallets docs** — New integration MDX pages (EN)
- **OSS security boundary** — Hardened `.gitignore`; public tree excludes `k8s/`, `cli/`, propagation manifests, and internal ops scripts

### Changed
- **Editor i18n** — Migrated from `editor-ui-copy.ts` pattern to `next-intl` + `locales/*/editor.json`
- **About narrative** — `about-trinity` renamed to `about-publisher` across routes and locales
- **API route layout** — Normalized handlers under `app/api/**` (legacy `app/(public)/api/**` removed)
- **Email IMAP config** — Empty-string defaults for `IMAP_PASSWORD` / `SMTP_PASSWORD` (env required; validation enforced)
- **Platform statistics** — 132 API route handlers, 96 page routes, 12 test suites (verified 2026-06-06)

### Security
- Removed hardcoded mail credential fallbacks in `services/email/imap/config.ts`
- Public repository no longer ships k8s secrets, Ring CLI, or empire-only deployment scripts
- Community clones use `install.sh`, `scripts/setup-dev.sh`, and env templates only

### Removed (public OSS)
- `cli/` deployment tooling (remains available locally for Ringdom empire ops, gitignored)
- Internal scripts: `setup-github-secrets`, `setup-vercel-env`, `import-firebase-service-account`, `add-products-production`

---

## [1.49] - 2026-02-05

### Added
- **Documentation Update** - Comprehensive README, ROADMAP, and CHANGELOG synchronization with verified facts
- **Ringdom Maps Update** - All 8 visualization maps updated with current platform statistics
- **Complete MCP Tools Documentation** - All 22 Legiox MCP tools fully documented in legiox-map

### Changed
- **Version Bump** - 1.48 → 1.49 with synchronized documentation
- **Statistics Verification** - 118+ API endpoints, 88+ routes, 12 test suites, 26 Radix UI components verified

---

## [1.48] - 2026-02-04

### Added
- **Legiox AI Integration** - 141 specialized AI agents with 22 MCP tools for development acceleration
- **Complete DatabaseService Migration** - 49 files converted from Firebase to PostgreSQL-native DatabaseService
- **Tunnel Protocol Firebase RTDB Analog** - Real-time pub/sub system replacing Firebase Realtime Database for K8s deployments

### Changed
- **React 19.2 + Next.js 16.5** - Latest framework versions with Server Components and optimistic updates
- **Tailwind CSS 4.1** - Modern utility-first styling with semantic token system
- **API Endpoints** - Expanded to 118+ documented endpoints
- **Application Routes** - Expanded to 88+ application routes

### Performance
- **Build Time** - Optimized to ~17 seconds
- **Bundle Size** - 260kB (55KB reduction via React 19 optimization)
- **Firebase Call Reduction** - 95% reduction during build via React 19 cache() patterns

---

## [1.47] - 2025-11-09

### Added
- **Complete Firebase-to-DatabaseService Migration** - 49 files fully migrated to Ring-native DatabaseService
- **PostgreSQL Transactions** - Atomic operations for financial operations (subscription-service.ts)
- **Ring Tunnel Protocol Integration** - Real-time messaging in message-service.ts, delete-opportunity.ts

### Changed
- **Build Cache System** - DatabaseService runtime with mock fallbacks for build-time
- **Event Logging** - DatabaseService with manual filtering/sorting
- **Seed Scripts** - DatabaseService for data seeding

### Technical
- Build successful: 14.2s compilation time
- Zero TypeScript errors during conversion
- All React 19 patterns implemented: cache(), revalidatePath(), Server Components

---

## [1.46] - 2025-11-07

### Added
- **Tunnel Protocol Multi-Transport** - WebSocket, SSE, Supabase Realtime, Firebase Realtime, Long-Polling
- **Reggie Local LLM** - Code transformation tool for development automation

### Changed
- **Real-time Architecture** - Unified transport abstraction with automatic fallback

---

## [1.45] - 2025-11-05

### Added
- **GreenFood User Widget System** - Revolutionary redesign with MiniCart, FavoritesMenu integration
- **Superbadge Layout** - Corner superbadge final layout for GreenFood branding

### Changed
- **Store Context** - @/features/store/context improvements
- **Navigation Components** - Enhanced user widget positioning

---

## [1.44] - 2025-11-04

### Added
- **Global Users Architecture** - Cross-platform user management for Ring Platform
- **Address Form Modal** - Theme wiring for consistent styling
- **Preorder Functionality** - Complete preorder system implementation
- **Dynamic Price Range with Caching** - Performance-optimized price filtering

### Changed
- **DatabaseService API Pattern** - Standardized API patterns for Ring Platform
- **Debounced Filtering Pattern** - Optimized filter interactions
- **Currency Toggle Bug Fix** - Resolved currency switching issues
- **Cart Currency Integration** - Unified currency handling in shopping cart
- **React 19 Server Component Hierarchy** - Proper component tree organization

### Fixed
- **Ring Platform Navigation Restoration** - Complete navigation system fix
- **Currency Toggle Bug** - Currency switching now works correctly

---

## [1.43] - 2025-11-03

### Added
- **GreenFood Store Implementation** - Complete e-commerce solution
- **Multi-Vendor Store Wiring** - 5 product page components (gallery, variants, add-to-cart, reviews, carousel)
- **Vendor Commission Tiers** - NEW(20%), BASIC(18%), VERIFIED(16%), TRUSTED(14%), PREMIUM(12%)

### Technical
- Product variants stored as JSONB array in store_products.data.variants
- Vendor query pattern: SELECT * FROM entities WHERE data->>'storeActivated' = 'true'

---

## [1.42] - 2025-11-02

### Fixed
- **Store Filter Data Flow** - Resolved filter state management issues

---

## [1.41] - 2025-11-01

### Added
- **Consolidated Floating Buttons Component** - Unified floating action buttons
- **Currency Context Global Implementation** - Global currency state management
- **Store Locale Remounting Pattern** - Proper locale switching in store

### Changed
- **Fixed Sidebar Grid Layout Pattern** - Responsive sidebar improvements
- **Floating Buttons Layout** - Final positioning and styling
- **Store Sticky Floating Buttons** - Finalized sticky behavior

### Fixed
- **Language Toggle Key Prop** - React key prop fix for language switching
- **React Key Prop Locale Remounting** - Proper component remounting on locale change
- **Window Location Href Full Reload** - Fixed navigation reload issues

---

## [1.40] - 2025-10-31

### Added
- **GreenFood Product Import** - Conquest-level product data migration
- **GreenFood Right Sidebar Filters** - Final filter implementation

### Changed
- **GreenFood Navigation Reorganization** - Improved navigation structure
- **Ring Platform to GreenFood Propagation** - Component sharing between platforms
- **Sidebar Conditional Controls Correction** - Fixed conditional rendering

---

## [1.39] - 2025-10-30

### Added
- **Tailwind 4 Semantic Token Migration** - Complete migration to Tailwind CSS 4 with semantic tokens

---

## [1.38] - 2025-10-29

### Added
- **Ring Platform Docs Welcome Page** - Comprehensive documentation landing page

---

## [1.37] - 2025-10-28

### Added
- **Documentation System Complete** - Full documentation infrastructure
- **Docs Code Component System** - Code highlighting and examples
- **Docs Mermaid MDX Component Solution** - Diagram rendering in docs
- **GreenFood Docs JSX Conversion** - Documentation format migration

### Fixed
- **Legiox MCP Diagnostic Audit** - Tool reliability improvements

---

## [1.36] - 2025-10-26

### Added
- **Legiox 21 Tools Perfect Tiers** - Complete MCP tool tier system
- **Legiox 18 Tools Triple Advancement** - Enhanced tool capabilities
- **AI-Context Timeline Organization** - Structured knowledge base

---

## [1.35] - 2025-10-25

### Added
- **Legiox Engine MCP Enhancements** - Improved MCP server functionality

---

## [1.34] - 2025-09-18

### Added
- **Database Abstraction Layer Phase 3-4** - Production-ready with PostgreSQL migration
- **Advanced Search Integration** - 100% complete with AdvancedFiltersWithSearch component
- **OpportunitiesSearchBar** - Enhanced search capabilities
- **SearchForm Dual Support** - Entity and opportunity search in one component

### Changed
- **EntityService** - Fully migrated (5 functions)
- **OpportunityService** - 88% migrated (7/8 functions)
- **React 19 cache()** - Optimization patterns implemented

### Performance
- **Cost Reduction** - 70-80% target achieved via intelligent BackendSelector

---

## [1.33] - 2025-08-27

### Added
- **Unified Entity Service** - Consolidated get-entity.ts and get-entity-by-id.ts
- **Multi-Vendor Marketplace** - Complete vendor lifecycle, inventory sync, automated settlement
- **Trust Scoring System** - Vendor trust levels and verification

### Changed
- **Entity Error Handling** - EntityNotFoundError/EntityAccessDeniedError classes
- **Confidential Entity Protection** - Enhanced access control

### Performance
- **Data Transfer Reduction** - 90%+ reduction in marketplace data transfer

---

## [1.32] - 2025-08-23

### Added
- **Tunnel Transport Production Ready** - Multi-transport abstraction with automatic fallback
- **Edge Runtime Compatibility** - Production JWT authentication

---

## [1.31] - 2025-07-17

### Added
- **RING Token System** - Complete membership system with smart contracts
- **Credit Balance System** - User credit management
- **Automatic Payments** - Blockchain-based automatic payment processing

### Performance
- **Firebase Optimization** - 95% call reduction via React 19 cache() patterns

---

## [1.30] - 2025-05-24

### Added
- **Entity CRUD Phases 1-2** - Complete entity management with role-based access control
- **Membership Upgrade Flow** - WayForPay integration at ₴299 UAH pricing
- **AddEntityButton Component** - Smart button with role awareness
- **MembershipUpgradeModal** - Subscriber upgrade UI
- **PaymentModal** - Payment processing interface

### Changed
- **Role-Based UI** - MEMBER users can create/edit/delete entities
- **Subscriber Experience** - Upgrade modal for entity creation attempts

---

## Legend

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features to be removed in upcoming releases
- **Removed**: Features removed in this release
- **Fixed**: Bug fixes
- **Security**: Security-related changes
- **Performance**: Performance improvements
- **Technical**: Internal technical changes

---

<p align="center">
  <strong>Ring Platform</strong> - Open Source Professional Networking
</p>
