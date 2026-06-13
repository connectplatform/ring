
# Ring Platform Development Backlog

> **Last Updated**: June 13, 2026  
> **Platform Version**: 1.6.4  
> **Platform Status**: Production-ready — 6+ K8s clones, OSS on `connectplatform/ring`

---

## ✅ COMPLETED (v1.6.2 – v1.6.4, June 2026)

### Store & Messenger
- ✅ **Store product AI chat** — Persisted agent threads on product pages, unified Ring Messenger, legacy chat component removal
- ✅ **SSE streaming LLM replies** — Multi-provider streaming (Anthropic/OpenAI/OpenRouter) with live UI bubble
- ✅ **Grok fallback + guest panel** — xAI when SSE unavailable; `UnifiedLoginInline` for guests with post-login panel restore

### Database & Types
- ✅ **ring-db `*Doc` migration** — Domain code on `db().createDoc` / `findDocById` / `queryDocs` / `db().transaction()`; auto-init throw-on-failure semantics
- ✅ **`*Doc` / `DbRow` typing** — `UserRow`, typed query generics, client/server bundle boundaries for editor and product-agent

### Auth & Navigation
- ✅ **`LoginAuthenticatedRedirect`** — Client-side authenticated `/login` redirect (no stale-cookie loops, no server `auth()` cold-start)
- ✅ **Sidebar hydration polish** — Mobile nav always mounted; SSR-safe theme toggle; aside collapse without blank placeholder

### Documentation
- ✅ **Docs path flatten** — `docs/{locale}/**`; resolver SSOT in `lib/docs/docs-path.ts`
- ✅ **Customization doc IA** — `/docs/customization/*` replaces `/docs/white-label/*` in platform navigation

---

## ✅ COMPLETED FEATURES (prior releases)

### 🏗️ Core Platform Infrastructure
- ✅ **React 19 + Next.js 16**: Server Components, streaming SSR, App Router, React Compiler
- ✅ **Auth.js v5**: Multi-provider OAuth, JWT sessions, slim proxy, PIN security
- ✅ **API Route Handlers**: 132+ RESTful endpoints (verified 2026-06-06)
- ✅ **TypeScript**: Strict mode, zero production errors
- ✅ **Testing**: 12 test suites, 95+ tests
- ✅ **PaymentConductor v1** — WayForPay + Stripe + internal credit ledger
- ✅ **Ring MCP Service Gateway** — `/api/mcp/v1/*` bearer-token API (v1.6.1)
- ✅ **Serialization Phase A/B** — `to-iso-date.ts`, MCP opportunity serializer (v1.6.1)

### 🚀 Revolutionary Features
- ✅ **Tunnel Transport Abstraction**: Multi-provider real-time with automatic fallback
- ✅ **AI-Powered Matching**: LLM contextual opportunity analysis
- ✅ **Dual-Nature Opportunities**: Offers + Requests unified system
- ✅ **KYC System**: Identity verification with status tracking
- ✅ **Unified Status Pages**: Dynamic `[action]/[status]` routing
- ✅ **Enterprise Security**: Hardened auth, rate limiting, OSS boundary

### 🎯 Domain Features
- ✅ **Entities**, **Opportunities**, **Messaging**, **Notifications**, **Wallet**, **Staking**, **Store**, **NFT Marketplace**
- ✅ **News Kingdom**, **Scientific Editor**, **Member blogs**, **Email AI CRM**
- ✅ **Locale SSOT** — `lib/locale-config.ts`

### 🔧 Infrastructure & DevOps
- ✅ **K8s production** — 6+ active clones (ring-platform.org, ringdom.org, greenfood.live, vikka.ua, zemna.ai, ring.ck.ua)
- ✅ **Docker setup** — See [DOCKER_SETUP.md](DOCKER_SETUP.md)
- ✅ **i18n**: EN / UK / RU with SEO optimization
- ✅ **Performance**: ~260kB bundle, ~17s build, Web Vitals monitoring

---

## 🚧 TODO: Missing Features & Improvements

### 🎯 High Priority (P0)

#### 1. **Video/Audio Calls**
- **Status**: 🚧 TODO
- **Description**: WebRTC integration for video/audio calls
- **Tasks**: Peer connections, call UI, tunnel signaling, call history

#### 2. **End-to-End Encryption**
- **Status**: 🚧 TODO
- **Description**: Secure message transmission
- **Tasks**: E2E keys, encrypted storage, UI indicators

#### 3. **Production Payment Processing**
- **Status**: ⚠️ Partial (WayForPay production; Stripe varies by clone)
- **Tasks**: Webhook hardening, invoice generation, subscription management at scale

#### 4. **Serialization Logic Hardening — Phase 2**
- **Status**: 🚧 TODO (plan: `.cursor/plans/serialization_logic_hardening_d3010b0f.plan.md`)
- **Tasks**: Consolidate opportunity serializers, adapter-boundary `toIsoDate`, domain-type detox, news/tunnel wire fixes

### 🔧 Medium Priority (P1)

#### 5. **Mobile Applications**
- **Status**: 🚧 TODO (PWA patterns exist; native apps not shipped)
- **Tasks**: React Native / Expo MVP, push notifications, store deployment

#### 6. **Advanced Search**
- **Status**: 🚧 TODO
- **Tasks**: Full-text search, facets, analytics, suggestions

#### 7. **CI/CD automation**
- **Status**: ⚠️ Partial
- **Tasks**: GitHub Actions for test + build gates, automated release tagging

#### 8. **Docs locale parity cleanup**
- **Status**: ⚠️ Partial — see [scripts/LOCALE-GAPS.md](scripts/LOCALE-GAPS.md)
- **Tasks**: UK/RU customization hub, affiliate-enablement pages; EN/UK/RU `library/` link sweep **done** (2026-06-13)

### 🌟 Low Priority (P2)

#### 9. **Platform-wide AI Assistant**
- **Status**: ⚠️ Partial (store product agent chat shipped; global help bot TODO)
- **Tasks**: Context-aware help UI, feedback loop, non-store surfaces

#### 10. **Advanced Analytics**
- **Status**: 🚧 TODO
- **Tasks**: Feature flags, A/B testing, predictive dashboards

#### 11. **Content Moderation**
- **Status**: 🚧 TODO
- **Tasks**: Automated scanning, reporting, moderation dashboard

### 🔮 Future Features (P3)

#### 12. **Blockchain Features**
- **Status**: 🚧 TODO
- **Tasks**: Multi-chain, cross-chain, DAO governance, advanced DeFi

#### 13. **Enterprise Features**
- **Status**: ⚠️ Partial (white-label clones live; enterprise SSO TODO)
- **Tasks**: SSO, advanced admin tools, instance management API

---

## 📊 Development Metrics

- **Version**: 1.6.4
- **API route handlers**: 132+
- **Page routes**: 96+
- **Build status**: ✅ Green (`tsc --noEmit` + Next.js build)
- **Test suites**: 12 (95+ tests)
- **Active K8s clones**: 6+
- **TODO items**: 13 tracked areas (several partial)

---

## 🎯 Next Sprint Priorities

1. **Serialization Phase 2** — Adapter-boundary dates, serializer consolidation
2. **Docs UK/RU customization hub** — Close gaps in `LOCALE-GAPS.md`
3. **E2E encryption spike** — Messaging security design
4. **CI/CD** — Automated test + type-check on PRs to `connectplatform/ring`

**Ring Platform is production-ready. Remaining items are enhancements, parity, and scale hardening.**
