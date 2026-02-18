-- ============================================================================
-- PostgreSQL Schema for Ring Platform
-- ============================================================================
-- Version: 4.0.0
-- Date: 2026-02-10
-- Database: ring_platform (or project-specific: ring_zemna_ai, ring_greenfood_live, etc.)
-- Purpose: SINGLE SOURCE OF TRUTH for all Ring Platform database schemas
-- Includes: Core, social, marketplace, store, content, FCM, reference data
-- Compatible with Ring Platform base architecture and all Ring clones
-- Replaces: scripts/postgres-schema.sql (deprecated)

-- ============================================================================
-- POSTGIS EXTENSIONS (Optional Geolocation - Reverse Propagation from ring-pet-friendly)
-- ============================================================================
-- Purpose: Enable spatial/geographic data types and functions for location-based features
-- Use Cases: Store delivery radius, entity locations, event venues, restaurant finders, real estate
-- Performance: Zero overhead if not used (PostgreSQL skips unused extensions)
-- Activation: Safe to run even if extensions already exist (IF NOT EXISTS)
-- Note: PostGIS enables GEOGRAPHY columns for accurate earth-surface distance calculations
-- Propagated from: ring-pet-friendly (2026-02-17) - Battle-tested geolocation patterns

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
-- ============================================================================
-- Changes from v3.0.0:
--   - Added 10 core tables: entities, opportunities, messages, conversations,
--     notifications, wallet_transactions, nft_listings, comments, likes, reviews
--   - Added usernames table (username reservation system)
--   - Fixed payments table: column-based -> JSONB model (matches PostgreSQLAdapter)
--   - Added LISTEN/NOTIFY real-time infrastructure
--   - Expanded trigger coverage to ALL tables
--   - Full-text search on opportunities
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- REFERENCE DATA TABLES (Seed data for all Ring clones)
-- ============================================================================

-- Currencies table (ISO 4217 + crypto tokens)
CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    is_crypto BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies (is_active);
CREATE INDEX IF NOT EXISTS idx_currencies_crypto ON currencies (is_crypto);

COMMENT ON TABLE currencies IS 'ISO 4217 currencies and crypto tokens for Ring ecosystem';
COMMENT ON COLUMN currencies.code IS 'ISO 4217 currency code (e.g., USD, EUR, UAH) or token symbol (RING, DAAR)';
COMMENT ON COLUMN currencies.symbol IS 'Currency display symbol (e.g., $, €, ₴, RING)';

-- Countries table (ISO 3166-1)
CREATE TABLE IF NOT EXISTS countries (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    flag VARCHAR(10),
    timezone VARCHAR(50) NOT NULL,
    phone_code VARCHAR(10) NOT NULL,
    currency_code VARCHAR(3),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_active ON countries (is_active);
CREATE INDEX IF NOT EXISTS idx_countries_timezone ON countries (timezone);
CREATE INDEX IF NOT EXISTS idx_countries_currency ON countries (currency_code);

COMMENT ON TABLE countries IS 'ISO 3166-1 countries with timezones and phone codes';
COMMENT ON COLUMN countries.code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN countries.timezone IS 'Primary IANA timezone (e.g., Europe/Kyiv)';
COMMENT ON COLUMN countries.phone_code IS 'International dialing code (e.g., +380)';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users ((data->>'email'));
CREATE INDEX IF NOT EXISTS idx_users_role ON users ((data->>'role'));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_data_gin ON users USING GIN (data);

COMMENT ON TABLE users IS 'User accounts with profile data, preferences, and settings';
COMMENT ON COLUMN users.id IS 'User ID (Firebase UID or UUID)';
COMMENT ON COLUMN users.data IS 'User data: email, role, displayName, avatar, preferences, credit_balance, etc.';

-- Usernames table (Username reservation system with expiration)
-- Reference: docs/content/en/library/features/username-reservation.mdx
CREATE TABLE IF NOT EXISTS usernames (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usernames_user_id ON usernames ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_usernames_confirmed ON usernames ((data->>'confirmed'));
CREATE INDEX IF NOT EXISTS idx_usernames_expires_at ON usernames ((data->>'expiresAt'));
CREATE INDEX IF NOT EXISTS idx_usernames_data_gin ON usernames USING GIN (data);

COMMENT ON TABLE usernames IS 'Username reservations with 5-minute expiration and confirmation tracking';
COMMENT ON COLUMN usernames.id IS 'Lowercase username key (unique identifier)';
COMMENT ON COLUMN usernames.data IS 'Reservation: userId, username (original case), reservedAt, expiresAt, confirmed, confirmedAt';

-- Entities table (Organizations, profiles, etc.)
CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_entities_verified ON entities ((data->>'verified'));
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entities_data_gin ON entities USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities ((data->>'name'));

COMMENT ON TABLE entities IS 'Organizations, profiles, and other entity types';
COMMENT ON COLUMN entities.id IS 'Entity identifier';
COMMENT ON COLUMN entities.data IS 'Entity data: name, type, userId, status, verified, description, etc.';

-- Opportunities table (Jobs, projects, bounties)
CREATE TABLE IF NOT EXISTS opportunities (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_opportunities_org_id ON opportunities ((data->>'organizationId'));
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities ((data->>'category'));
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON opportunities ((data->>'priority'));
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_data_gin ON opportunities USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_opportunities_title ON opportunities ((data->>'title'));

-- Full-text search for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_search ON opportunities 
USING GIN (to_tsvector('english', 
    COALESCE(data->>'title', '') || ' ' || 
    COALESCE(data->>'briefDescription', '') || ' ' || 
    COALESCE(data->>'tags', '')
));

COMMENT ON TABLE opportunities IS 'Jobs, projects, bounties, and other opportunities';
COMMENT ON COLUMN opportunities.id IS 'Opportunity identifier';
COMMENT ON COLUMN opportunities.data IS 'Opportunity: title, description, type, category, status, budget, location, etc.';

-- ============================================================================
-- MESSAGING TABLES
-- ============================================================================

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages ((data->>'conversationId'));
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages ((data->>'senderId'));
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_data_gin ON messages USING GIN (data);

COMMENT ON TABLE messages IS 'Chat messages within conversations';

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN ((data->'participants'));
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_data_gin ON conversations USING GIN (data);

COMMENT ON TABLE conversations IS 'Chat conversations between users';

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications ((data->>'read'));
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_data_gin ON notifications USING GIN (data);

COMMENT ON TABLE notifications IS 'User notifications (system, social, transactional)';

-- ============================================================================
-- SOCIAL TABLES
-- ============================================================================

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity_id ON comments ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_data_gin ON comments USING GIN (data);

COMMENT ON TABLE comments IS 'User comments on entities, news, products, etc.';

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_likes_entity_id ON likes ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_data_gin ON likes USING GIN (data);

COMMENT ON TABLE likes IS 'User likes/reactions on content';

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_entity_id ON reviews ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews (((data->'rating')::numeric));
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_data_gin ON reviews USING GIN (data);

COMMENT ON TABLE reviews IS 'User reviews with ratings for vendors, products, etc.';

-- ============================================================================
-- WEB3 / WALLET TABLES
-- ============================================================================

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions ((data->>'walletId'));
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_data_gin ON wallet_transactions USING GIN (data);

COMMENT ON TABLE wallet_transactions IS 'Blockchain wallet transactions (deposits, withdrawals, transfers)';

-- NFT Listings table
CREATE TABLE IF NOT EXISTS nft_listings (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_listings_user_id ON nft_listings ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_status ON nft_listings ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_created_at ON nft_listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_listings_data_gin ON nft_listings USING GIN (data);

COMMENT ON TABLE nft_listings IS 'NFT marketplace listings';

-- ============================================================================
-- MARKETPLACE TABLES (Multi-vendor marketplace module)
-- ============================================================================

-- Products (Marketplace products - any type)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_products_category ON products ((data->>'category'));
CREATE INDEX IF NOT EXISTS idx_products_certified ON products ((data->>'certified'));
CREATE INDEX IF NOT EXISTS idx_products_price ON products (((data->'price')::numeric));
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_data_gin ON products USING GIN (data);

-- Full-text search for products
CREATE INDEX IF NOT EXISTS idx_products_search ON products 
USING GIN (to_tsvector('english', 
    COALESCE(data->>'name', '') || ' ' || 
    COALESCE(data->>'description', '') || ' ' || 
    COALESCE(data->>'tags', '')
));

COMMENT ON TABLE products IS 'Marketplace products from verified vendors';

-- Vendors (Marketplace sellers)
CREATE TABLE IF NOT EXISTS vendors (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_vendors_verified ON vendors ((data->>'verified'));
CREATE INDEX IF NOT EXISTS idx_vendors_certified ON vendors ((data->>'certified'));
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_data_gin ON vendors USING GIN (data);

COMMENT ON TABLE vendors IS 'Marketplace vendors and sellers';

-- Vendor Profiles (Extended vendor management)
CREATE TABLE IF NOT EXISTS vendor_profiles (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user_id ON vendor_profiles ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_entity_id ON vendor_profiles ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_onboarding_status ON vendor_profiles ((data->>'onboardingStatus'));
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_trust_level ON vendor_profiles ((data->>'trustLevel'));
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_created_at ON vendor_profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_data_gin ON vendor_profiles USING GIN (data);

COMMENT ON TABLE vendor_profiles IS 'Extended vendor profiles with trust scores and compliance tracking';

-- Orders (Customer purchases from marketplace)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_data_gin ON orders USING GIN (data);

COMMENT ON TABLE orders IS 'Customer purchase orders from marketplace';

-- Certifications (Quality certifications, badges)
CREATE TABLE IF NOT EXISTS certifications (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_vendor_id ON certifications ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_certifications_product_id ON certifications ((data->>'productId'));
CREATE INDEX IF NOT EXISTS idx_certifications_type ON certifications ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_certifications_created_at ON certifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certifications_data_gin ON certifications USING GIN (data);

COMMENT ON TABLE certifications IS 'Quality certifications and badges for vendors/products';

-- Delivery Zones (Regional availability)
CREATE TABLE IF NOT EXISTS delivery_zones (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_region ON delivery_zones ((data->>'region'));
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones ((data->>'active'));
CREATE INDEX IF NOT EXISTS idx_delivery_zones_data_gin ON delivery_zones USING GIN (data);

COMMENT ON TABLE delivery_zones IS 'Regional delivery availability';

-- ============================================================================
-- STORE TABLES (Ring Platform Store Module)
-- ============================================================================

-- Store Products (Ring Portal Store items - hosting, hardware, courses)
CREATE TABLE IF NOT EXISTS store_products (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_products_vendor_id ON store_products ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products ((data->>'category'));
CREATE INDEX IF NOT EXISTS idx_store_products_status ON store_products ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_store_products_price ON store_products (((data->'price')::numeric));
CREATE INDEX IF NOT EXISTS idx_store_products_created_at ON store_products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_data_gin ON store_products USING GIN (data);

-- Full-text search for store products
CREATE INDEX IF NOT EXISTS idx_store_products_search ON store_products 
USING GIN (to_tsvector('english', 
    COALESCE(data->>'name', '') || ' ' || 
    COALESCE(data->>'description', '') || ' ' || 
    COALESCE(data->>'tags', '')
));

COMMENT ON TABLE store_products IS 'Ring Portal Store products (hosting, hardware, courses)';

-- Store Settings (Performance cache for computed values)
-- NOTE: Uses 'value' column (not 'data') - special-case table
CREATE TABLE IF NOT EXISTS store_settings (
    id VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_settings_id ON store_settings(id);

COMMENT ON TABLE store_settings IS 'Store settings cache (price ranges, filters, computed values)';
COMMENT ON COLUMN store_settings.id IS 'Setting key (e.g., price_range, featured_products)';
COMMENT ON COLUMN store_settings.value IS 'JSONB value with arbitrary structure';
COMMENT ON COLUMN store_settings.updated_at IS 'Last cache update timestamp (for expiry checks)';

-- Payments (WayForPay membership upgrades and transactions)
-- Reference: Agent #124 (WayForPay Integrator)
-- NOTE: Uses standard JSONB model (id, data, created_at, updated_at)
-- Data fields: orderId, userId, targetRole, amount, currency, status, paymentUrl, failureReason
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_data_gin ON payments USING GIN (data);

COMMENT ON TABLE payments IS 'WayForPay membership upgrade payment tracking';
COMMENT ON COLUMN payments.id IS 'Payment identifier (orderId from WayForPay: ring_{userId}_{timestamp})';
COMMENT ON COLUMN payments.data IS 'Payment: orderId, userId, targetRole, amount, currency, status, paymentUrl, failureReason';

-- Store Orders (Customer purchases from Ring Portal Store)
CREATE TABLE IF NOT EXISTS store_orders (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_orders_user_id ON store_orders ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_store_orders_vendor_id ON store_orders ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_store_orders_created_at ON store_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_data_gin ON store_orders USING GIN (data);

COMMENT ON TABLE store_orders IS 'Customer orders from Ring Portal Store (hosting, hardware, courses)';

-- ============================================================================
-- NEWS / CONTENT TABLES
-- ============================================================================

-- News table
CREATE TABLE IF NOT EXISTS news (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_author_id ON news ((data->>'authorId'));
CREATE INDEX IF NOT EXISTS idx_news_category ON news ((data->>'category'));
CREATE INDEX IF NOT EXISTS idx_news_status ON news ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news ((data->>'publishedAt'));
CREATE INDEX IF NOT EXISTS idx_news_locale ON news ((data->>'locale'));
CREATE INDEX IF NOT EXISTS idx_news_translation_group ON news ((data->>'translationGroupId'));
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_data_gin ON news USING GIN (data);

COMMENT ON TABLE news IS 'Ring Platform news and content articles';

-- ============================================================================
-- FCM PUSH NOTIFICATION TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fcm_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    token VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB NOT NULL,
    platform VARCHAR(50),
    browser VARCHAR(100),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_is_active ON fcm_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_seen ON fcm_tokens(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_platform ON fcm_tokens(platform);

COMMENT ON TABLE fcm_tokens IS 'Firebase Cloud Messaging push notification tokens per device';

-- ============================================================================
-- SCHEMA VERSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by TEXT DEFAULT CURRENT_USER
);

INSERT INTO schema_versions (version, description) 
VALUES ('4.0.0', 'Unified schema: merged core tables from scripts/postgres-schema.sql, fixed payments to JSONB, added usernames, added LISTEN/NOTIFY')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- OPTIONAL: BUSINESS SUBSCRIPTIONS (Reverse propagated from ring-pet-friendly)
-- ============================================================================
-- Purpose: Enable B2B recurring billing for Ring clones (vendor tiers, entity promotions, featured listings)
-- Use Cases: Multi-vendor marketplaces, premium entity visibility, opportunity promotion, SaaS B2B models
-- Billing: Stripe integration (one-time fees + recurring subscriptions)
-- Grace Period: 3-7 days configurable grace period for failed payments
-- Visibility Control: Automated show/hide based on subscription status
--
-- Schema Pattern:
-- - id: Auto-generated with 'sub_' prefix
-- - Entity reference: Flexible (place_id, entity_id, opportunity_id, etc.) - adapt foreign key as needed
-- - Stripe IDs: customer_id + subscription_id for webhook handling
-- - JSONB data: Flexible structure for plan details, pricing, billing periods, grace period
-- - Status tracking: pending -> active -> grace_period -> past_due -> canceled/suspended
--
-- To Enable:
-- 1. Uncomment this table
-- 2. Update foreign key reference (place_id -> entity_id or other)
-- 3. Add Stripe environment variables
-- 4. Implement webhook handler at app/api/webhooks/stripe/route.ts
-- 5. Create subscription service at features/subscriptions/
-- ============================================================================

/*
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(255) PRIMARY KEY DEFAULT ('sub_' || uuid_generate_v4()::text),
    -- CUSTOMIZE THIS: Replace place_id with your entity reference
    entity_id VARCHAR(255) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- JSONB structure for subscriptions.data:
-- {
--   "stripe_payment_intent_id": "string",
--   "plan_type": "basic|premium|enterprise",
--   "billing_period": "monthly|yearly",
--   "monthly_price": 10.00,
--   "listing_fee": 19.99,
--   "currency": "USD",
--   "status": "pending|active|grace_period|past_due|canceled|suspended",
--   "trial_start_at": "ISO timestamp",
--   "trial_end_at": "ISO timestamp",
--   "current_period_start": "ISO timestamp",
--   "current_period_end": "ISO timestamp",
--   "cancel_at": "ISO timestamp",
--   "canceled_at": "ISO timestamp",
--   "ended_at": "ISO timestamp",
--   "grace_period_days": 7,
--   "grace_period_ends_at": "ISO timestamp",
--   "listing_fee_paid": boolean,
--   "listing_fee_paid_at": "ISO timestamp",
--   "last_payment_at": "ISO timestamp",
--   "next_payment_at": "ISO timestamp",
--   "failed_payment_count": number,
--   "renewal_reminder_sent": boolean,
--   "payment_failure_notified": boolean,
--   "metadata": {}
-- }

CREATE INDEX IF NOT EXISTS idx_subscriptions_entity ON subscriptions(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment ON subscriptions((data->>'next_payment_at'))
    WHERE (data->>'status') = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_data_gin ON subscriptions USING GIN(data);

COMMENT ON TABLE subscriptions IS 'Business subscription billing via Stripe (one-time fees + recurring billing) - Reverse propagated from ring-pet-friendly';
COMMENT ON COLUMN subscriptions.data IS 'Subscription data: Stripe IDs, pricing, status, billing periods, grace period, visibility control';

-- Trigger: Auto-update updated_at timestamp
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
*/

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp (standard JSONB tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update store_settings timestamp (special-case table)
CREATE OR REPLACE FUNCTION update_store_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers for ALL standard tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            -- Core
            'users', 'usernames', 'entities', 'opportunities',
            -- Messaging
            'messages', 'conversations', 'notifications',
            -- Social
            'comments', 'likes', 'reviews',
            -- Web3
            'wallet_transactions', 'nft_listings',
            -- Marketplace
            'products', 'vendors', 'vendor_profiles', 'orders',
            'certifications', 'delivery_zones',
            -- Store
            'store_products', 'store_orders', 'payments',
            -- Content
            'news',
            -- Reference
            'currencies', 'countries'
        )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- FCM tokens trigger (separate because table uses uuid-ossp)
CREATE OR REPLACE TRIGGER update_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Store settings trigger (uses its own timestamp function)
DROP TRIGGER IF EXISTS update_store_settings_timestamp_trigger ON store_settings;
CREATE TRIGGER update_store_settings_timestamp_trigger
    BEFORE UPDATE ON store_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_store_settings_timestamp();

-- ============================================================================
-- REAL-TIME NOTIFICATIONS (LISTEN/NOTIFY)
-- ============================================================================

-- Function to broadcast table changes via pg_notify
CREATE OR REPLACE FUNCTION notify_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    payload = json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP,
        'id', NEW.id,
        'data', NEW.data
    );
    
    PERFORM pg_notify('table_changes', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create NOTIFY triggers for real-time update tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('opportunities', 'messages', 'notifications', 'conversations', 'payments')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS notify_%I_change ON %I;
            CREATE TRIGGER notify_%I_change
            AFTER INSERT OR UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION notify_change();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert initial price range cache (will be updated by API)
INSERT INTO store_settings (id, value)
VALUES ('price_range', '{"minPrice": 0, "maxPrice": 3000}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed currencies (fiat + crypto)
INSERT INTO currencies (code, name, symbol, decimal_places, is_crypto, is_active) VALUES
    ('UAH', 'Ukrainian Hryvnia', '₴', 2, FALSE, TRUE),
    ('USD', 'United States Dollar', '$', 2, FALSE, TRUE),
    ('EUR', 'Euro', '€', 2, FALSE, TRUE),
    ('GBP', 'British Pound', '£', 2, FALSE, TRUE),
    ('PLN', 'Polish Zloty', 'zł', 2, FALSE, TRUE),
    ('RNG', 'Ring Token', 'RING', 4, TRUE, TRUE),
    ('DAAR', 'Daar Token', 'DAAR', 4, TRUE, TRUE),
    ('DAARION', 'Daarion Token', 'DAARION', 4, TRUE, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    is_active = EXCLUDED.is_active;

-- Seed countries (core markets)
INSERT INTO countries (code, name, flag, timezone, phone_code, currency_code, is_active) VALUES
    ('UA', 'Ukraine', '🇺🇦', 'Europe/Kyiv', '+380', 'UAH', TRUE),
    ('US', 'United States', '🇺🇸', 'America/New_York', '+1', 'USD', TRUE),
    ('GB', 'United Kingdom', '🇬🇧', 'Europe/London', '+44', 'GBP', TRUE),
    ('CA', 'Canada', '🇨🇦', 'America/Toronto', '+1', 'USD', TRUE),
    ('AU', 'Australia', '🇦🇺', 'Australia/Sydney', '+61', 'USD', TRUE),
    ('DE', 'Germany', '🇩🇪', 'Europe/Berlin', '+49', 'EUR', TRUE),
    ('FR', 'France', '🇫🇷', 'Europe/Paris', '+33', 'EUR', TRUE),
    ('ES', 'Spain', '🇪🇸', 'Europe/Madrid', '+34', 'EUR', TRUE),
    ('IT', 'Italy', '🇮🇹', 'Europe/Rome', '+39', 'EUR', TRUE),
    ('NL', 'Netherlands', '🇳🇱', 'Europe/Amsterdam', '+31', 'EUR', TRUE),
    ('BE', 'Belgium', '🇧🇪', 'Europe/Brussels', '+32', 'EUR', TRUE),
    ('AT', 'Austria', '🇦🇹', 'Europe/Vienna', '+43', 'EUR', TRUE),
    ('CH', 'Switzerland', '🇨🇭', 'Europe/Zurich', '+41', 'EUR', TRUE),
    ('PL', 'Poland', '🇵🇱', 'Europe/Warsaw', '+48', 'PLN', TRUE),
    ('CZ', 'Czech Republic', '🇨🇿', 'Europe/Prague', '+420', 'EUR', TRUE),
    ('SK', 'Slovakia', '🇸🇰', 'Europe/Bratislava', '+421', 'EUR', TRUE),
    ('HU', 'Hungary', '🇭🇺', 'Europe/Budapest', '+36', 'EUR', TRUE),
    ('RO', 'Romania', '🇷🇴', 'Europe/Bucharest', '+40', 'EUR', TRUE),
    ('BG', 'Bulgaria', '🇧🇬', 'Europe/Sofia', '+359', 'EUR', TRUE),
    ('GR', 'Greece', '🇬🇷', 'Europe/Athens', '+30', 'EUR', TRUE),
    ('TR', 'Turkey', '🇹🇷', 'Europe/Istanbul', '+90', 'USD', TRUE),
    ('PT', 'Portugal', '🇵🇹', 'Europe/Lisbon', '+351', 'EUR', TRUE),
    ('SE', 'Sweden', '🇸🇪', 'Europe/Stockholm', '+46', 'EUR', TRUE),
    ('NO', 'Norway', '🇳🇴', 'Europe/Oslo', '+47', 'EUR', TRUE),
    ('DK', 'Denmark', '🇩🇰', 'Europe/Copenhagen', '+45', 'EUR', TRUE),
    ('FI', 'Finland', '🇫🇮', 'Europe/Helsinki', '+358', 'EUR', TRUE),
    ('IE', 'Ireland', '🇮🇪', 'Europe/Dublin', '+353', 'EUR', TRUE),
    ('LT', 'Lithuania', '🇱🇹', 'Europe/Vilnius', '+370', 'EUR', TRUE),
    ('LV', 'Latvia', '🇱🇻', 'Europe/Riga', '+371', 'EUR', TRUE),
    ('EE', 'Estonia', '🇪🇪', 'Europe/Tallinn', '+372', 'EUR', TRUE),
    ('MD', 'Moldova', '🇲🇩', 'Europe/Chisinau', '+373', 'USD', TRUE),
    ('BY', 'Belarus', '🇧🇾', 'Europe/Minsk', '+375', 'USD', TRUE),
    ('GE', 'Georgia', '🇬🇪', 'Asia/Tbilisi', '+995', 'USD', TRUE),
    ('AM', 'Armenia', '🇦🇲', 'Asia/Yerevan', '+374', 'USD', TRUE),
    ('AZ', 'Azerbaijan', '🇦🇿', 'Asia/Baku', '+994', 'USD', TRUE),
    ('KZ', 'Kazakhstan', '🇰🇿', 'Asia/Almaty', '+7', 'USD', TRUE),
    ('UZ', 'Uzbekistan', '🇺🇿', 'Asia/Tashkent', '+998', 'USD', TRUE),
    ('JP', 'Japan', '🇯🇵', 'Asia/Tokyo', '+81', 'USD', TRUE),
    ('KR', 'South Korea', '🇰🇷', 'Asia/Seoul', '+82', 'USD', TRUE),
    ('CN', 'China', '🇨🇳', 'Asia/Shanghai', '+86', 'USD', TRUE),
    ('IN', 'India', '🇮🇳', 'Asia/Kolkata', '+91', 'USD', TRUE),
    ('SG', 'Singapore', '🇸🇬', 'Asia/Singapore', '+65', 'USD', TRUE),
    ('TH', 'Thailand', '🇹🇭', 'Asia/Bangkok', '+66', 'USD', TRUE),
    ('VN', 'Vietnam', '🇻🇳', 'Asia/Ho_Chi_Minh', '+84', 'USD', TRUE),
    ('MY', 'Malaysia', '🇲🇾', 'Asia/Kuala_Lumpur', '+60', 'USD', TRUE),
    ('ID', 'Indonesia', '🇮🇩', 'Asia/Jakarta', '+62', 'USD', TRUE),
    ('PH', 'Philippines', '🇵🇭', 'Asia/Manila', '+63', 'USD', TRUE),
    ('AE', 'United Arab Emirates', '🇦🇪', 'Asia/Dubai', '+971', 'USD', TRUE),
    ('SA', 'Saudi Arabia', '🇸🇦', 'Asia/Riyadh', '+966', 'USD', TRUE),
    ('IL', 'Israel', '🇮🇱', 'Asia/Jerusalem', '+972', 'USD', TRUE),
    ('EG', 'Egypt', '🇪🇬', 'Africa/Cairo', '+20', 'USD', TRUE),
    ('ZA', 'South Africa', '🇿🇦', 'Africa/Johannesburg', '+27', 'USD', TRUE),
    ('NG', 'Nigeria', '🇳🇬', 'Africa/Lagos', '+234', 'USD', TRUE),
    ('KE', 'Kenya', '🇰🇪', 'Africa/Nairobi', '+254', 'USD', TRUE),
    ('MA', 'Morocco', '🇲🇦', 'Africa/Casablanca', '+212', 'USD', TRUE),
    ('BR', 'Brazil', '🇧🇷', 'America/Sao_Paulo', '+55', 'USD', TRUE),
    ('MX', 'Mexico', '🇲🇽', 'America/Mexico_City', '+52', 'USD', TRUE),
    ('AR', 'Argentina', '🇦🇷', 'America/Argentina/Buenos_Aires', '+54', 'USD', TRUE),
    ('CL', 'Chile', '🇨🇱', 'America/Santiago', '+56', 'USD', TRUE),
    ('CO', 'Colombia', '🇨🇴', 'America/Bogota', '+57', 'USD', TRUE),
    ('PE', 'Peru', '🇵🇪', 'America/Lima', '+51', 'USD', TRUE),
    ('NZ', 'New Zealand', '🇳🇿', 'Pacific/Auckland', '+64', 'USD', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    flag = EXCLUDED.flag,
    timezone = EXCLUDED.timezone,
    phone_code = EXCLUDED.phone_code,
    currency_code = EXCLUDED.currency_code,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to ring_user (Docker container user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ring_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ring_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ring_user;

-- Grant permissions to greenfood_user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greenfood_user') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO greenfood_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO greenfood_user;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO greenfood_user;
    END IF;
END
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables (28 total):
--   Reference: currencies, countries
--   Core: users, usernames, entities, opportunities
--   Messaging: messages, conversations, notifications
--   Social: comments, likes, reviews
--   Web3: wallet_transactions, nft_listings
--   Marketplace: products, vendors, vendor_profiles, orders, certifications, delivery_zones
--   Store: store_products, store_settings, payments, store_orders
--   Content: news
--   FCM: fcm_tokens
--   Meta: schema_versions
-- ============================================================================

SELECT 
    'Ring Platform Schema v4.0.0 - Installation Complete' as message,
    COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';
