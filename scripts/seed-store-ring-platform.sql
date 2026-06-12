-- ============================================================
-- Ring Platform Marketplace — Product Seed
-- Audience: CTOs, CEOs, developers, solo founders, indie devs
-- Run: psql $DATABASE_URL -f scripts/seed-store-ring-platform.sql
-- ============================================================

BEGIN;

-- Clear existing products (safe: ring-platform.org DB only)
DELETE FROM store_products WHERE (data->>'vendorId') = 'vendor_ring_portal_store';

-- ── CATEGORY: ring-platform ─────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_ring_community', jsonb_build_object(
  'name',            'Ring Platform — Community Edition',
  'slug',            'ring-platform-community',
  'description',     'Full source code of Ring Platform v1.6 — React 19, Next.js 16, Auth.js 5, Tailwind 4, PostgreSQL, Web3. Clone, customize, deploy. Zero licensing cost, forever.',
  'longDescription', 'The complete open-source Ring Platform: multi-tenant whitelabel architecture, AI opportunity matching, real-time messaging, multi-vendor store, Web3 wallet, NFT marketplace, and 20+ production-ready modules. MIT licensed. Deploy anywhere.',
  'price',           0,
  'currency',        'USD',
  'category',        'ring-platform',
  'tags',            '["open-source", "react19", "nextjs16", "saas", "boilerplate", "free"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'RING-COMMUNITY-V160',
  'externalUrl',     'https://github.com/connectplatform/ring'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_professional', jsonb_build_object(
  'name',            'Ring Platform — Professional Setup',
  'slug',            'ring-platform-professional',
  'description',     'Guided production setup of Ring Platform: environment config, PostgreSQL schema, k8s deployment, SSL, first-week support. Everything configured by Ring engineers.',
  'longDescription', 'Includes: complete .env configuration for your domain, PostgreSQL schema migration and initial seed, Kubernetes manifests for k3s/k8s deployment, CI/CD pipeline setup, SSL certificate configuration, Auth provider setup (Google, Apple, email magic-link), first-week technical support via dedicated Telegram channel. Delivered in 48–72h.',
  'price',           299,
  'currency',        'USD',
  'category',        'ring-platform',
  'tags',            '["setup", "production", "k8s", "professional", "support"]',
  'status',          'active',
  'inStock',         true,
  'stock',           50,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'RING-PROFESSIONAL-SETUP'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_strategy_call', jsonb_build_object(
  'name',            'Ring Architecture Strategy Call (60 min)',
  'slug',            'ring-architecture-strategy-call',
  'description',     'A 60-minute 1:1 call with a Ring Platform architect. Design your clone, discuss customizations, get deployment strategy, and leave with a clear action plan.',
  'longDescription', 'Who is this for: CTOs evaluating Ring Platform for enterprise use, founders designing a white-label product, teams migrating from legacy stacks to React 19 / Next.js 16. What you get: recorded session, written summary, architecture diagram, prioritized action plan.',
  'price',           199,
  'currency',        'USD',
  'category',        'ring-platform',
  'tags',            '["consulting", "architecture", "strategy", "1-on-1"]',
  'status',          'active',
  'inStock',         true,
  'stock',           20,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-STRATEGY-CALL-60'
));

-- ── CATEGORY: expert-services ───────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_legiox_starter', jsonb_build_object(
  'name',            'Legiox-Promptor: Ring Clone Starter (1 week)',
  'slug',            'legiox-promptor-ring-clone-starter',
  'description',     'A certified Legiox-Promptor customizes your Ring clone in 1 focused week: branding, localization, feature config, initial seed data, deployment.',
  'longDescription', 'Week 1 deliverables: branded domain + logo, 2 locales configured, 3 entity types for your industry, opportunity categories configured, store categories set, homepage content localized, production deployment on your server or Vercel. Ideal for: MVPs, demo environments, industry-specific pilots. Outcome: a live, working Ring clone with your brand.',
  'price',           299,
  'currency',        'USD',
  'category',        'expert-services',
  'tags',            '["legiox-promptor", "white-label", "customization", "mvp", "1-week"]',
  'status',          'active',
  'inStock',         true,
  'stock',           10,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'LEGIOX-PROMPTOR-STARTER'
));

INSERT INTO store_products (id, data) VALUES
('prod_legiox_growth', jsonb_build_object(
  'name',            'Legiox-Promptor: Ring Clone Growth (4 weeks)',
  'slug',            'legiox-promptor-ring-clone-growth',
  'description',     'Full white-label Ring build over 4 weeks: custom features, database schema extensions, integrations (payments, auth, APIs), production k8s deployment, and 30-day support.',
  'longDescription', 'Weeks 1–4: discovery + requirements → branding + theming → feature configuration + custom module development → production deployment. Includes: custom entity types, opportunity categories and AI matching config, store with seed products, WayForPay or Stripe integration, push notifications, email templates, k8s manifests, 30-day post-delivery support. Suitable for: organizations building industry platforms, SaaS founders, government/NGO portals.',
  'price',           999,
  'currency',        'USD',
  'category',        'expert-services',
  'tags',            '["legiox-promptor", "white-label", "full-build", "4-weeks", "growth"]',
  'status',          'active',
  'inStock',         true,
  'stock',           5,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'LEGIOX-PROMPTOR-GROWTH'
));

INSERT INTO store_products (id, data) VALUES
('prod_legiox_enterprise', jsonb_build_object(
  'name',            'Legiox-Promptor: Enterprise Ring Deployment',
  'slug',            'legiox-promptor-enterprise',
  'description',     'Production-grade, fully customized Ring Platform deployment for organizations. Custom features, enterprise integrations (SSO, LDAP, CRM), 90-day support SLA.',
  'longDescription', 'For enterprises and larger organizations. Includes everything in Growth + custom module development (up to 3 new features), enterprise SSO integration, API integrations with existing CRM/ERP, high-availability k8s configuration with auto-scaling, custom analytics dashboard, team training (up to 10 people), 90-day dedicated support. Delivered in 4–8 weeks depending on scope.',
  'price',           4999,
  'currency',        'USD',
  'category',        'expert-services',
  'tags',            '["enterprise", "legiox-promptor", "sso", "custom-features", "90-day-support"]',
  'status',          'active',
  'inStock',         true,
  'stock',           3,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'LEGIOX-PROMPTOR-ENTERPRISE'
));

-- ── CATEGORY: dev-kits ──────────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_ring_k8s_bundle', jsonb_build_object(
  'name',            'Ring k8s Deployment Bundle',
  'slug',            'ring-k8s-deployment-bundle',
  'description',     'Complete Kubernetes deployment package for Ring Platform on k3s or standard k8s: Deployments, Services, Ingress, CNPG PostgreSQL, secrets templates, HPA, and CI/CD pipeline config.',
  'longDescription', 'Everything you need to deploy Ring Platform on Kubernetes: Deployment manifests for Next.js + PostgreSQL, Ingress config with cert-manager SSL, HPA for auto-scaling, ConfigMap and Secret templates (all safe to commit after substitution), GitHub Actions CI/CD pipeline, Helm chart starter, CNPG PostgreSQL operator configuration, Persistent Volume setup. Tested on k3s 1.29+ and standard GKE/EKS/AKS.',
  'price',           49,
  'currency',        'USD',
  'category',        'dev-kits',
  'tags',            '["kubernetes", "k8s", "k3s", "deployment", "devops", "ci-cd"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'RING-K8S-BUNDLE-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_env_template', jsonb_build_object(
  'name',            'Ring Platform .env Configuration Template',
  'slug',            'ring-env-configuration-template',
  'description',     'Fully annotated .env.local template with all Ring Platform variables documented, sensible defaults, and provider setup checklists for PostgreSQL, Auth.js, Firebase, WayForPay, Web3, and more.',
  'longDescription', 'Stop spending hours decoding which env variables are required. This annotated template covers every Ring variable with: what it does, where to get the value, which provider to set up, whether it is required or optional, and example values. Sections: Database, Auth, Firebase, Storage, Payments, Web3, Email, Analytics, Feature Flags. Updated for Ring Platform v1.6.',
  'price',           0,
  'currency',        'USD',
  'category',        'dev-kits',
  'tags',            '["env", "config", "setup", "beginner", "free"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-ENV-TEMPLATE-FREE'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_db_schema', jsonb_build_object(
  'name',            'Ring Platform Database Schema v4.0 Export',
  'slug',            'ring-database-schema-v4-export',
  'description',     'Full annotated PostgreSQL schema export for Ring Platform v4.0: all tables, JSONB field maps, indexes, constraints, and PostGIS extensions explained with business context.',
  'longDescription', 'Understand exactly what data Ring stores and how. Includes: full schema.sql with inline comments explaining every table and field, JSONB field documentation (what goes in each data field), index rationale, foreign key map diagram, sample queries for common operations. Essential for: developers extending the schema, architects evaluating Ring for enterprise use, engineers integrating Ring with existing databases.',
  'price',           19,
  'currency',        'USD',
  'category',        'dev-kits',
  'tags',            '["postgresql", "schema", "database", "architecture", "documentation"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-DB-SCHEMA-V4'
));

-- ── CATEGORY: ai-tools ──────────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_legiox_cursor_rules', jsonb_build_object(
  'name',            'LegioX Cursor Rules Pack',
  'slug',            'legiox-cursor-rules-pack',
  'description',     'Production-tested Cursor rules and CLAUDE.md templates for Ring Platform development: MCP tool usage, React 19 patterns, Auth.js 5 flows, DB service contract, and zero-hallucination prompt patterns.',
  'longDescription', 'Includes: .cursorrules for Ring Platform (React 19 server-component boundaries, Auth.js 5 patterns, DatabaseService contract, next-intl i18n conventions), CLAUDE.md template with project context, 5 truth lens starters (Backend, Auth, Web3, React, Payments), LegioX agent selector usage guide, and example MCP payloads for legiox-knowledge and reggie-mcp. Shave hours off every coding session.',
  'price',           19,
  'currency',        'USD',
  'category',        'ai-tools',
  'tags',            '["cursor", "claude", "ai-coding", "prompts", "rules", "mcp"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'LEGIOX-CURSOR-RULES-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_ai_prompt_library', jsonb_build_object(
  'name',            'Ring AI Matcher Prompt Library',
  'slug',            'ring-ai-matcher-prompt-library',
  'description',     '30+ production-tested prompts for AI opportunity matching in Ring Platform: entity analysis, 8-factor scoring, match explanation generation, personalized DM notification drafting.',
  'longDescription', 'The exact prompts powering Ring Platform AI matching engine. Includes: entity profile analysis prompt (extract skills, interests, capacity), 8-factor match scoring system prompt, personalized 160-char match explanation generator, DM notification personalization prompts, batch matching orchestration prompt, match quality evaluation prompt. Each prompt includes: purpose, input schema, output format, example, and tuning notes. Works with any LLM (Claude, GPT, Gemini).',
  'price',           29,
  'currency',        'USD',
  'category',        'ai-tools',
  'tags',            '["ai-matching", "prompts", "llm", "opportunity-matching", "ring-ai"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'RING-AI-PROMPT-LIB-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_nodus_framework', jsonb_build_object(
  'name',            'NODUS LLM-First Document Schema Framework',
  'slug',            'nodus-llm-first-document-schema',
  'description',     'The NODUS framework: a structured JSON schema for AI agent knowledge bases, truth lenses, and domain specialists. Used by LegioX with 251+ agents across 27 cohorts.',
  'longDescription', 'NODUS (Networked Object Description Using Schemas) is a production-proven framework for building LLM-first structured knowledge. Includes: complete NODUS v2.0 JSON schema with all 11 required fields, validation rubric, 5 example truth lenses across different domains (Backend, Auth, Web3, Analytics, Security), NODUS parser script, integration guide for Cursor MCP servers, and tutorial on building a 10-agent cohort from scratch. Based on the LegioX architecture powering Ring Platform AI.',
  'price',           49,
  'currency',        'USD',
  'category',        'ai-tools',
  'tags',            '["nodus", "knowledge-base", "ai-agents", "llm", "schema", "legiox"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'NODUS-SCHEMA-FRAMEWORK-V2'
));

-- ── CATEGORY: digital-templates ─────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_ring_launch_playbook', jsonb_build_object(
  'name',            'Ring Clone Launch Playbook',
  'slug',            'ring-clone-launch-playbook',
  'description',     'Step-by-step launch playbook for Ring Platform white-label clones: pre-launch checklist, SEO metadata setup, user onboarding email sequence, first-100-users strategy, and analytics dashboard setup.',
  'longDescription', 'Everything non-technical founders need to launch a Ring clone successfully. Includes: 47-point pre-launch technical checklist, SEO metadata configuration guide, 5-email onboarding sequence templates, first-100-users acquisition checklist (10 channels), social proof and community setup guide, Product Hunt launch kit, Google Analytics + Umami setup, and 30-day post-launch activity calendar. Tested on GreenFood.live and PetFriend.app launches.',
  'price',           39,
  'currency',        'USD',
  'category',        'digital-templates',
  'tags',            '["launch", "playbook", "marketing", "seo", "onboarding", "strategy"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-LAUNCH-PLAYBOOK-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_mcp_server_pack', jsonb_build_object(
  'name',            'Ring MCP Server Configuration Pack',
  'slug',            'ring-mcp-server-configuration-pack',
  'description',     'Complete mcp.json configurations and server setup guides for all Ring Platform MCP servers: legiox-mcp, reggie-mcp, ringdom-mcp, and 4 community MCP servers used in Ring development.',
  'longDescription', 'Everything to set up Ring Platform MCP tooling in Cursor. Includes: mcp.json template with all 7 Ring MCP servers, individual server setup guides (install, authenticate, verify), tool payload reference for all 27 LegioX tools, troubleshooting guide for common MCP failures, and integration patterns for Claude Code and GitHub Copilot. Stop re-reading docs every time you start a new Ring project.',
  'price',           29,
  'currency',        'USD',
  'category',        'digital-templates',
  'tags',            '["mcp", "cursor", "legiox", "configuration", "devtools"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-MCP-SERVER-PACK-V1'
));

-- ── CATEGORY: saas-assets ───────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_pr_ops_starter', jsonb_build_object(
  'name',            'PR-Ops Starter Bundle for Tech Founders',
  'slug',            'pr-ops-starter-bundle',
  'description',     'Press release templates, social media launch kit, developer community outreach guides, and journalist contact playbook — everything to get your Ring-powered product covered by tech media.',
  'longDescription', 'Getting press coverage is 80% preparation. Includes: 3 press release templates (product launch, funding, partnership), 20 social post templates for X/LinkedIn/HN launch, developer community posting guides (Reddit, Dev.to, HackerNews etiquette), cold email templates for 5 journalist personas, Product Hunt page template, blog post series template (5 topics), and media kit checklist. All battle-tested by Ring Platform and Ringdom product launches.',
  'price',           79,
  'currency',        'USD',
  'category',        'saas-assets',
  'tags',            '["pr", "press", "marketing", "launch", "media", "founder-kit"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'PR-OPS-STARTER-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_connect_software_api_docs', jsonb_build_object(
  'name',            'ConnectPlatform API Integration Guide',
  'slug',            'connect-platform-api-integration-guide',
  'description',     'Complete technical guide to integrating ConnectPlatform OTP v28 ASN.1/BERT realtime backend with Ring Platform: 75-500x faster than HTTP, millions of concurrent connections.',
  'longDescription', 'ConnectPlatform is the Erlang-powered realtime backbone for Ring. This guide covers: ConnectPlatform architecture overview (OTP v28, ASN.1/BERT), Ring Platform WebSocket bridge setup, authentication flow integration (Auth.js 5 ↔ ConnectPlatform sessions), messaging module wiring, push notification pipeline, and performance benchmarks. For teams who need Firebase-class realtime features without Firebase pricing. Includes Erlang client examples and JavaScript SDK usage.',
  'price',           49,
  'currency',        'USD',
  'category',        'saas-assets',
  'tags',            '["connect-platform", "erlang", "realtime", "websocket", "api", "integration"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'CONNECT-API-GUIDE-V1'
));

-- ── CATEGORY: learn ─────────────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_ring_quickstart_course', jsonb_build_object(
  'name',            'Ring Platform Quick Start Video Course',
  'slug',            'ring-platform-quick-start-course',
  'description',     'Go from zero to a live Ring clone in a weekend. Covers: environment setup, database seeding, auth config, first customizations, deployment. Video + written guides.',
  'longDescription', '7-module video course (4 hours total) + companion written guide. Modules: 1. Ring Platform architecture overview (what each module does), 2. Local development setup (Docker, DB, env), 3. Auth.js 5 configuration (Google, email magic-link), 4. Branding and theming (Tailwind 4, logo, colors), 5. Content seeding (opportunities, entities, store products), 6. Deployment to k3s/Vercel, 7. First customizations (entity types, categories, locales). Prerequisites: basic Next.js knowledge.',
  'price',           49,
  'currency',        'USD',
  'category',        'learn',
  'tags',            '["course", "video", "quickstart", "nextjs", "ring-platform", "learning"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'RING-QUICKSTART-COURSE-V1'
));

INSERT INTO store_products (id, data) VALUES
('prod_authjs5_guide', jsonb_build_object(
  'name',            'Auth.js 5 + Ring Platform Integration Deep Dive',
  'slug',            'authjs5-ring-platform-integration-guide',
  'description',     'Comprehensive written guide to Auth.js v5 on Ring Platform: JWT strategy, session refresh, OAuth providers, magic links, middleware, role-based access, and common gotchas.',
  'longDescription', 'Auth.js v5 broke the old next-auth API significantly. This guide covers every Ring Platform auth pattern: JWT strategy with custom session callback, refresh-token rotation, Google + Apple + email magic-link provider setup, middleware for route protection, role-based access (User/Entity/Admin/Superadmin), wallet-connect auth integration (wagmi v3), server-side vs client-side session access, and the 8 most common auth bugs in Ring deployments. Includes code samples for all patterns.',
  'price',           29,
  'currency',        'USD',
  'category',        'learn',
  'tags',            '["auth", "authjs5", "nextauth", "jwt", "oauth", "security", "guide"]',
  'status',          'active',
  'inStock',         true,
  'stock',           9999,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'AUTHJS5-RING-GUIDE-V1'
));

-- ── CATEGORY: community ─────────────────────────────────────

INSERT INTO store_products (id, data) VALUES
('prod_hromada_pre_enrollment', jsonb_build_object(
  'name',            'Hromada Academy — Pre-Enrollment (2026)',
  'slug',            'hromada-academy-pre-enrollment-2026',
  'description',     'Secure your seat in Hromada Academy 2026: AI-instructor-led Ring Platform mastery through legendary gameplay. Learn to build, customize, and deploy Ring clones while playing.',
  'longDescription', 'Hromada Academy is the world''s first AI-instructor coding school built on top of Ring Platform itself. Students learn by doing: conquering kingdoms = deploying Ring clones, completing quests = shipping features, forming guilds = building SaaS teams. Pre-enrollment secures your seat and gives you access to: pre-course materials (Ring Platform setup guide, LegioX primer), invite to the pre-cohort community, early-bird pricing (save 40% vs launch price), and direct line to Ring Platform architects. Opening 2026.',
  'price',           99,
  'currency',        'USD',
  'category',        'community',
  'tags',            '["hromada-academy", "learning", "community", "coding-school", "2026"]',
  'status',          'active',
  'inStock',         true,
  'stock',           100,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        true,
  'images',          '[]',
  'sku',             'HROMADA-ACADEMY-PRE-2026'
));

INSERT INTO store_products (id, data) VALUES
('prod_ring_builders_network', jsonb_build_object(
  'name',            'Ring Builders Network — Founding Member',
  'slug',            'ring-builders-network-founding-member',
  'description',     'Join the private Ring Builders Network: monthly calls with Ring Platform architects, early feature access, private Telegram group, PR partner opportunities, and co-marketing for your Ring clone.',
  'longDescription', 'A curated community of founders and CTOs building with Ring Platform. Founding member perks: monthly 90-min group call with Ring architects (roadmap review, Q&A), private Telegram group with direct access to Ring core team, early beta access to new Ring modules before public release, co-marketing opportunities (your clone featured on ring-platform.org, social amplification), partner listing on ringdom.org, and the Ring Builders badge on your Ring clone profile. Annual membership — limited to 50 founding members.',
  'price',           199,
  'currency',        'USD',
  'category',        'community',
  'tags',            '["community", "network", "membership", "founders", "ring-builders"]',
  'status',          'active',
  'inStock',         true,
  'stock',           50,
  'vendorId',        'vendor_ring_portal_store',
  'vendorName',      'Ring Portal Store',
  'featured',        false,
  'images',          '[]',
  'sku',             'RING-BUILDERS-NETWORK-FOUNDING'
));

COMMIT;
