-- PostgreSQL Schema for Ring Platform
-- Version: 1.0.0
-- Database: ring_platform
-- Compatible with Firebase Firestore document model using JSONB

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB operators
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

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

-- Entities table
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

-- Opportunities table
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
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_data_gin ON news USING GIN (data);

-- Store Products table
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

-- Store Orders table
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

-- Payments table (WayForPay membership upgrades)
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

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'entities', 'opportunities', 'messages', 'conversations', 
                         'notifications', 'wallet_transactions', 'nft_listings', 'news',
                         'store_products', 'store_orders', 'comments', 'likes', 'reviews', 'payments')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END;
$$;

-- =============================================================================
-- REAL-TIME NOTIFICATIONS (LISTEN/NOTIFY)
-- =============================================================================

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

-- Create NOTIFY triggers for real-time updates
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
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
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ring_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ring_user;

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- List all tables
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Show table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;


