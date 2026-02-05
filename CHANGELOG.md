# Changelog

All notable changes to Ring Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.49] - 2026-02-05

### Added
- **Documentation Update** - Comprehensive README, ROADMAP, and CHANGELOG synchronization with verified facts
- **Ringdom Maps Update** - All 8 visualization maps updated with current platform statistics
- **Complete MCP Tools Documentation** - All 22 Legion MCP tools fully documented in legion-map

### Changed
- **Version Bump** - 1.48 → 1.49 with synchronized documentation
- **Statistics Verification** - 118+ API endpoints, 88+ routes, 12 test suites, 26 Radix UI components verified

---

## [1.48] - 2026-02-04

### Added
- **Legion AI Integration** - 141 specialized AI agents with 22 MCP tools for development acceleration
- **Complete DatabaseService Migration** - 49 files converted from Firebase to PostgreSQL-native DatabaseService
- **Tunnel Protocol Firebase RTDB Analog** - Real-time pub/sub system replacing Firebase Realtime Database for K8s deployments

### Changed
- **React 19.2 + Next.js 15.5** - Latest framework versions with Server Components and optimistic updates
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
- **Legion MCP Diagnostic Audit** - Tool reliability improvements

---

## [1.36] - 2025-10-26

### Added
- **Legion 21 Tools Perfect Tiers** - Complete MCP tool tier system
- **Legion 18 Tools Triple Advancement** - Enhanced tool capabilities
- **AI-Context Timeline Organization** - Structured knowledge base

---

## [1.35] - 2025-10-25

### Added
- **Legion Engine MCP Enhancements** - Improved MCP server functionality

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
