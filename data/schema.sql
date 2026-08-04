-- ============================================================================
-- PostgreSQL Schema for Ring Platform (flattened SSOT)
-- ============================================================================
-- Version: 4.1.0
-- Date: 2026-07-24
-- Source: prior schema.sql + data/migrations/*.sql (skips legacy 001_email_crm_schema.sql)
-- Fresh installs: apply THIS FILE ONLY (install.sh setup-db / scripts/setup-clone-db.sh).
-- Existing DBs: add incremental files under data/migrations/, then re-run flatten.
-- Rebuild: scripts/flatten-schema-from-migrations.sh
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Homebrew)

SET client_encoding = 'UTF8';

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: email_flow_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_flow_type AS ENUM (
    'otp_code',
    'magic_link',
    'email_verify',
    'password_reset'
);


--
-- Name: notify_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_store_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;




--
-- Name: account_status_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_status_audit (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE account_status_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_status_audit IS 'Audit log for account suspend/reactivate actions (fraud desk)';


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.accounts IS 'Auth.js v5 linked OAuth accounts (Google, Apple, etc.). Each row links a third-party provider account to a Ring user.';


--
-- Name: COLUMN accounts.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.data IS 'provider, providerAccountId, userId, tokens, scope, etc.';


--
-- Name: analytics_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_errors (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE analytics_errors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_errors IS 'Client-side error logs — JSONB';


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE analytics_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_events IS 'Client app/navigation telemetry — JSONB; one row per event';


--
-- Name: certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certifications (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE certifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.certifications IS 'Quality certifications and badges for vendors/products';


--
-- Name: collective_order_escrows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collective_order_escrows (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE collective_order_escrows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.collective_order_escrows IS 'Groupon-style collective_order prepaid slot ledger (PaymentPurpose collective_order_slot)';


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comments IS 'User comments on entities, news, products, etc.';


--
-- Name: compliance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_events (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE compliance_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_events IS 'Compliance screening audit trail — JSONB';


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversations IS 'Chat conversations between users';


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    code character varying(2) NOT NULL,
    name character varying(100) NOT NULL,
    flag character varying(10),
    timezone character varying(50) NOT NULL,
    phone_code character varying(10) NOT NULL,
    currency_code character varying(3),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE countries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.countries IS 'ISO 3166-1 countries with timezones and phone codes';


--
-- Name: COLUMN countries.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.countries.code IS 'ISO 3166-1 alpha-2 country code';


--
-- Name: COLUMN countries.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.countries.timezone IS 'Primary IANA timezone (e.g., Europe/Kyiv)';


--
-- Name: COLUMN countries.phone_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.countries.phone_code IS 'International dialing code (e.g., +380)';


--
-- Name: credit_add_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_add_events (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE credit_add_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credit_add_events IS 'Idempotent credit-add events — JSONB';


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencies (
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    symbol character varying(10) NOT NULL,
    decimal_places integer DEFAULT 2,
    is_crypto boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE currencies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.currencies IS 'ISO 4217 currencies and crypto tokens for Ring ecosystem';


--
-- Name: COLUMN currencies.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.currencies.code IS 'ISO 4217 currency code (e.g., USD, EUR, UAH) or token symbol (RING, DAAR)';


--
-- Name: COLUMN currencies.symbol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.currencies.symbol IS 'Currency display symbol (e.g., $, €, ₴, RING)';


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE delivery_zones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.delivery_zones IS 'Regional delivery availability';


--
-- Name: desk_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desk_orders (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE desk_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.desk_orders IS 'CoinDesk settlement state machine — JSONB';


--
-- Name: email_api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_api_usage (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_api_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_api_usage IS 'Anthropic API usage records for email CRM cost tracking';


--
-- Name: email_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_contacts (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_contacts IS 'Email CRM contacts (leads, customers, partners)';


--
-- Name: email_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_drafts (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_drafts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_drafts IS 'AI/manual reply drafts pending review';


--
-- Name: email_login_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_login_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(254) NOT NULL,
    token_hash character varying(64) NOT NULL,
    flow_type public.email_flow_type DEFAULT 'otp_code'::public.email_flow_type NOT NULL,
    user_id character varying(255),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    ip_address inet,
    attempt_count smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE email_login_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_login_tokens IS 'Ring Mailer auth tokens — store HMAC/SHA256 hashes only; never raw OTP or magic tokens';


--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_messages IS 'Individual email messages within CRM threads';


--
-- Name: email_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_tasks (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_tasks IS 'Email CRM follow-up and escalation tasks';


--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_threads (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_threads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_threads IS 'Email CRM conversation threads';


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE entities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.entities IS 'Organizations, profiles, and other entity types';


--
-- Name: COLUMN entities.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entities.id IS 'Entity identifier';


--
-- Name: COLUMN entities.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entities.data IS 'Entity data: name, type, userId, status, verified, description, etc.';


--
-- Name: entity_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_reports (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE entity_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.entity_reports IS 'User-submitted entity moderation reports';


--
-- Name: COLUMN entity_reports.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_reports.data IS 'entityId, reporterUserId, category, reason, status, createdAt';


--
-- Name: erp_sales_assists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_sales_assists (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE erp_sales_assists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.erp_sales_assists IS 'Referral-attributed sales assists for ERP analytics';


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.events IS 'Append-only platform event log — JSONB; matcher runs, auto-approvals, training examples';


--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fcm_tokens (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE fcm_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fcm_tokens IS 'FCM push tokens — JSONB data; one row per (userId, deviceFingerprint)';


--
-- Name: file_cabinet_acl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_cabinet_acl (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE file_cabinet_acl; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file_cabinet_acl IS 'File cabinet ACL — role owner|trustee (legacy editor→trustee); immediate grant (no invite accept)';


--
-- Name: file_cabinet_desktop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_cabinet_desktop (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE file_cabinet_desktop; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file_cabinet_desktop IS 'Win3.11 desktop icon layouts — scope own|shared; synced via publishToUserTunnel';


--
-- Name: file_cabinet_gallery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_cabinet_gallery_items (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE file_cabinet_gallery_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file_cabinet_gallery_items IS 'Curated gallery subset of cabinet files — visibility private|unlisted|public; public CDN /files/{uuid}';


--
-- Name: file_cabinet_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_cabinet_nodes (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE file_cabinet_nodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file_cabinet_nodes IS 'Personal file cabinet nodes — kind file|dir; storage via file()/RingFileBase CDN /files/{uuid}';


--
-- Name: generated_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_images (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE generated_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.generated_images IS 'AI-generated images stored in ring-filebase via ImageConductor';


--
-- Name: generated_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_videos (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE generated_videos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.generated_videos IS 'AI-generated videos stored in ring-filebase via VideoConductor';


--
-- Name: generated_docs_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_docs_media (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE generated_docs_media; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.generated_docs_media IS 'Cached docs narration/walkthrough media URLs keyed by locale+slug+contentHash';


--
-- Name: docs_article_enrichment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_article_enrichment (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE docs_article_enrichment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.docs_article_enrichment IS 'Derived docs fields: audible-text (radio-host script), tts-audio meta, llm-text NODUS subtree';


--
-- Name: inventory_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_levels (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE inventory_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inventory_levels IS 'Per product+store inventory levels (id = productId_storeId)';


--
-- Name: inventory_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reservations (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE inventory_reservations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inventory_reservations IS 'Order inventory holds with TTL — released by cron cleanup-reservations';


--
-- Name: likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.likes (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE likes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.likes IS 'User likes/reactions on content';


--
-- Name: matcher_moderation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matcher_moderation_events (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE matcher_moderation_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.matcher_moderation_events IS 'Matcher/admin moderation queue fed by entity report and block actions';


--
-- Name: matcher_verification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matcher_verification_events (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE matcher_verification_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.matcher_verification_events IS 'Matcher/admin verification queue fed by procedure submit and review actions';


--
-- Name: merchant_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merchant_configs (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE merchant_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.merchant_configs IS 'Per-merchant commission structure, settlement rules, and wallet routing';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.messages IS 'Chat messages within conversations';


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE news; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.news IS 'News & announcements (JSONB document model)';


--
-- Name: news_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_categories (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE news_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.news_categories IS 'News category metadata';


--
-- Name: news_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_likes (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: news_submission_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_submission_audit (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE news_submission_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.news_submission_audit IS 'Audit trail for blog main-page promotion and Telegram approvals';


--
-- Name: nft_entitlement_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_entitlement_cache (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_entitlement_cache; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_entitlement_cache IS 'Feature entitlement cache (24h TTL); invalidate on unstake/burn';


--
-- Name: nft_gate_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_gate_purchases (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_gate_purchases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_gate_purchases IS 'NFT gate primary-sale pay→mint ledger; refund recovery keyed by paySignature';


--
-- Name: nft_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_gates (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_gates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_gates IS 'NFT gate template editions / price history (Metaplex Core assets)';


--
-- Name: nft_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_listings (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_listings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_listings IS 'Solana Metaplex Core NFT Exhibition marketplace listings; legacy EVM rows stay chainFamily=evm and excluded from new feed';


--
-- Name: nft_market_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_market_collections (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_market_collections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_market_collections IS 'Verified NFT collection metadata and marketplace aggregate cache';


--
-- Name: nft_market_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_market_sales (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_market_sales; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_market_sales IS 'Idempotent NFT marketplace sale/reconciliation ledger for atomic RING settlement';


--
-- Name: nft_member_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_member_collections (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_member_collections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_member_collections IS 'On-platform member-created Metaplex Core collections (Exhibition lane M); KEYS gates remain lane K';


--
-- Name: nft_ownership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_ownership (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_ownership; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_ownership IS 'Primary-sale ownership ledger for gate NFTs (asset, slug, purchase signature)';


--
-- Name: nft_stakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nft_stakes (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE nft_stakes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nft_stakes IS 'GateEscrow stake rows (userId, asset, slug, escrowPda); RPC-verify at gate check';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE notification_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_preferences IS 'Per-user notification channel/type preferences';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'User notifications (system, social, transactional)';


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE opportunities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.opportunities IS 'Jobs, projects, bounties, and other opportunities';


--
-- Name: COLUMN opportunities.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.opportunities.id IS 'Opportunity identifier';


--
-- Name: COLUMN opportunities.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.opportunities.data IS 'Opportunity: title, description, type, category, status, budget, location, etc.';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.orders IS 'Customer purchase orders from marketplace';


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payment_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_transactions IS 'Kingdom-wide payment ledger for PaymentConductor (all purposes/rails)';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payments IS 'WayForPay membership upgrade payment tracking';


--
-- Name: COLUMN payments.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payments.id IS 'Payment identifier (orderId from WayForPay: ring_{userId}_{timestamp})';


--
-- Name: COLUMN payments.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payments.data IS 'Payment: orderId, userId, targetRole, amount, currency, status, paymentUrl, failureReason';


--
-- Name: payout_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_batches (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payout_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payout_batches IS 'Batch payout runs from processDueSettlements';


--
-- Name: peer_game_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_game_sessions (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE peer_game_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.peer_game_sessions IS 'Peer mini-game sessions — status pending|active|completed|declined|resigned; Tunnel fan-out game:{id}';


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id character varying(64) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    secrets jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE platform_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.platform_settings IS 'SUPERadmin platform settings by namespace id (ai, branding, …)';


--
-- Name: COLUMN platform_settings.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.platform_settings.id IS 'Settings namespace key';


--
-- Name: COLUMN platform_settings.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.platform_settings.data IS 'Non-secret configuration JSON';


--
-- Name: COLUMN platform_settings.secrets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.platform_settings.secrets IS 'API keys and secrets (masked in admin GET)';


--
-- Name: process_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_runs (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE process_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.process_runs IS 'Background pipeline run history (ProcessConductor)';


--
-- Name: product_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_fields (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE product_custom_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_custom_fields IS 'Per-category custom product fields for vendor store products. Vendors can add custom parameters per product category. All known product custom fields and categories are shipped with SQL migrations per preset.';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.products IS 'Marketplace products from verified vendors';


--
-- Name: project_deployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_deployments (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE project_deployments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_deployments IS 'Order Lab per-order deploy config (edge, encrypted env, k8s names) for ring clone builds';


--
-- Name: project_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_orders (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE project_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_orders IS 'CRM custom orders from Ring Project Calculator — payment + work lifecycle (not store SKUs)';


--
-- Name: project_wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_wallet_transactions (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE project_wallet_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_wallet_transactions IS 'Per-project wallet transfer history — JSONB';


--
-- Name: project_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_wallets (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE project_wallets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_wallets IS 'Per-project wallet accounts — JSONB; scoped by global_user_id + project_slug';


--
-- Name: public_pool_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_pool_contributions (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE public_pool_contributions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.public_pool_contributions IS 'Native-token chip-ins for public pools — JSONB';


--
-- Name: public_pool_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_pool_signals (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE public_pool_signals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.public_pool_signals IS 'Likes/votes on public pools — one active like per user per pool';


--
-- Name: public_pools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_pools (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE public_pools; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.public_pools IS 'Per-clone community jars (future_feature, city_dao, etc.) — JSONB';


--
-- Name: refcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refcodes (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE refcodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refcodes IS 'Shareable referral codes — one per user wallet';


--
-- Name: referral_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_rewards (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE referral_rewards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.referral_rewards IS 'Referral reward payouts — pending approval, minted on-chain';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reviews IS 'User reviews with ratings for vendors, products, etc.';


--
-- Name: ring_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ring_contacts (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ring_contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ring_contacts IS 'Per-project Ring user address book — JSONB; scoped by owner_user_id + project_slug';


--
-- Name: schema_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_versions (
    version character varying(50) NOT NULL,
    description text NOT NULL,
    applied_at timestamp with time zone DEFAULT now(),
    applied_by text DEFAULT CURRENT_USER
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sessions IS 'Auth.js v5 session tokens. Cookie-based session management for authenticated users.';


--
-- Name: COLUMN sessions.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.data IS 'sessionToken, userId, expires';


--
-- Name: settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlements (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE settlements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.settlements IS 'Canonical vendor commission/payout ledger (ERP commissions tab + vendor earnings)';


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE stock_movements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_movements IS 'ERP inventory audit trail (sales, restock, adjustments)';


--
-- Name: store_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_orders (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE store_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_orders IS 'Customer orders from Ring Portal Store (hosting, hardware, courses)';


--
-- Name: store_user_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_user_carts (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE store_user_carts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_user_carts IS 'Session cart mirror for authenticated buyers (agent tools + client hydrate)';


--
-- Name: store_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_products (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE store_products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_products IS 'Ring Portal Store products (hosting, hardware, courses)';


--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_settings (
    id character varying(255) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE store_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_settings IS 'Store settings cache (price ranges, filters, computed values)';


--
-- Name: COLUMN store_settings.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_settings.id IS 'Setting key (e.g., price_range, featured_products)';


--
-- Name: COLUMN store_settings.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_settings.value IS 'JSONB value with arbitrary structure';


--
-- Name: COLUMN store_settings.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_settings.updated_at IS 'Last cache update timestamp (for expiry checks)';


--
-- Name: subscription_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_ledger (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE subscription_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_ledger IS 'Multi-provider subscription SSOT (Stripe, WayForPay, RING credit, on-chain RING, NFT, PayPal). Drives SubscriptionConductor + 5 cron pipelines.';


--
-- Name: task_escrows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_escrows (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE task_escrows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_escrows IS 'Chat task escrow holds (PaymentPurpose task_escrow)';


--
-- Name: telegram_admin_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_admin_audit (
    id character varying(255) NOT NULL,
    telegram_id character varying(50) NOT NULL,
    user_id character varying(255),
    raw_message text NOT NULL,
    parsed_intent jsonb,
    action_taken jsonb,
    result jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE telegram_admin_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.telegram_admin_audit IS 'Audit log for Admin Telegram Bot operations (PALADIN security layer)';


--
-- Name: COLUMN telegram_admin_audit.telegram_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.telegram_id IS 'Telegram Chat ID of sender';


--
-- Name: COLUMN telegram_admin_audit.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.user_id IS 'Ring Platform user ID (admin/superadmin)';


--
-- Name: COLUMN telegram_admin_audit.raw_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.raw_message IS 'Original message text from Telegram';


--
-- Name: COLUMN telegram_admin_audit.parsed_intent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.parsed_intent IS 'Anthropic Claude parsed intent and tool calls';


--
-- Name: COLUMN telegram_admin_audit.action_taken; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.action_taken IS 'Ring API operations executed';


--
-- Name: COLUMN telegram_admin_audit.result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.result IS 'Operation results and response data';


--
-- Name: COLUMN telegram_admin_audit.error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.telegram_admin_audit.error IS 'Error message if operation failed';


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_addresses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_addresses IS 'Saved shipping addresses for store checkout (AddressService SSOT)';


--
-- Name: user_content_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_content_interactions (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_content_interactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_content_interactions IS 'Opportunity feed save/not_interested/contact_intent rows with matcher signal weights';


--
-- Name: user_device_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_device_telemetry (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_device_telemetry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_device_telemetry IS 'Last-known device/session telemetry per user+device+domain — JSONB upsert (Ring Analytics)';


--
-- Name: user_peer_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_peer_games (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_peer_games; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_peer_games IS 'Member public peer-game availability — enabledSlugs[]; profile /{username}/games';


--
-- Name: usernames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usernames (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE usernames; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usernames IS 'Username reservations with 5-minute expiration and confirmation tracking';


--
-- Name: COLUMN usernames.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usernames.id IS 'Lowercase username key (unique identifier)';


--
-- Name: COLUMN usernames.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usernames.data IS 'Reservation: userId, username (original case), reservedAt, expiresAt, confirmed, confirmedAt';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'User accounts with profile data, preferences, and settings';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS 'User ID (Firebase UID or UUID)';


--
-- Name: COLUMN users.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.data IS 'User data: email, role (lowercase enum: visitor|subscriber|member|confidential|admin|superadmin), displayName, avatar, preferences, credit_balance, etc.';


--
-- Name: vendor_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_profiles (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE vendor_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendor_profiles IS 'Extended vendor profiles with trust scores and compliance tracking';


--
-- Name: vendor_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_settlements (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE vendor_settlements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendor_settlements IS 'Legacy processing log — canonical ledger is settlements';


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE vendors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendors IS 'Marketplace vendors and sellers';


--
-- Name: verification_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_counters (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE verification_counters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.verification_counters IS 'Global procedure number sequence per year (id = YYYY)';


--
-- Name: verification_procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_procedures (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE verification_procedures; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.verification_procedures IS 'Unified verification procedure SSOT (user_kyc, entity_identity, vendor_store)';


--
-- Name: COLUMN verification_procedures.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_procedures.data IS 'procedureNumber, attemptNumber, subjectType, subjectId, applicantUserId, status, statusHistory, documents, forensics';


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE verification_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.verification_tokens IS 'Auth.js v5 email magic-link / OTP verification tokens. One-time use, deleted after consumption.';


--
-- Name: COLUMN verification_tokens.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tokens.data IS 'identifier, token, expires';


--
-- Name: wallet_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_access_tokens (
    id character varying(255) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE wallet_access_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wallet_access_tokens IS 'PIN-gated single-use access tokens for wallet operations (withdrawal, transfer). Raw token never stored — only sha256 hash.';


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE wallet_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wallet_transactions IS 'Blockchain wallet transactions (deposits, withdrawals, transfers)';


--
-- Name: web_vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_vitals (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE web_vitals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_vitals IS 'Core Web Vitals batches — JSONB';


--
-- Name: wiki_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wiki_events (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE wiki_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wiki_events IS 'Admin Wiki append-only ops log (derived catalog — not a Markdown page)';


--
-- Name: wiki_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wiki_links (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE wiki_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wiki_links IS 'Admin Wiki graph edges (SSOT) — local + tenant_ref (@ / tenant:) wikilinks';


--
-- Name: wiki_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wiki_pages (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE wiki_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wiki_pages IS 'Admin Wiki Markdown pages — vaultKey tenant|po:{orderId}, [[wikilinks]], agent+human KB';


--
-- Name: account_status_audit account_status_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_status_audit
    ADD CONSTRAINT account_status_audit_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: analytics_errors analytics_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_errors
    ADD CONSTRAINT analytics_errors_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: certifications certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certifications
    ADD CONSTRAINT certifications_pkey PRIMARY KEY (id);


--
-- Name: collective_order_escrows collective_order_escrows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collective_order_escrows
    ADD CONSTRAINT collective_order_escrows_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: compliance_events compliance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (code);


--
-- Name: credit_add_events credit_add_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_add_events
    ADD CONSTRAINT credit_add_events_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (code);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: desk_orders desk_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desk_orders
    ADD CONSTRAINT desk_orders_pkey PRIMARY KEY (id);


--
-- Name: email_api_usage email_api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_api_usage
    ADD CONSTRAINT email_api_usage_pkey PRIMARY KEY (id);


--
-- Name: email_contacts email_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_contacts
    ADD CONSTRAINT email_contacts_pkey PRIMARY KEY (id);


--
-- Name: email_drafts email_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_pkey PRIMARY KEY (id);


--
-- Name: email_login_tokens email_login_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_login_tokens
    ADD CONSTRAINT email_login_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);


--
-- Name: email_tasks email_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tasks
    ADD CONSTRAINT email_tasks_pkey PRIMARY KEY (id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: entity_reports entity_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_reports
    ADD CONSTRAINT entity_reports_pkey PRIMARY KEY (id);


--
-- Name: erp_sales_assists erp_sales_assists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sales_assists
    ADD CONSTRAINT erp_sales_assists_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: file_cabinet_acl file_cabinet_acl_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_cabinet_acl
    ADD CONSTRAINT file_cabinet_acl_pkey PRIMARY KEY (id);


--
-- Name: file_cabinet_desktop file_cabinet_desktop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_cabinet_desktop
    ADD CONSTRAINT file_cabinet_desktop_pkey PRIMARY KEY (id);


--
-- Name: file_cabinet_gallery_items file_cabinet_gallery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_cabinet_gallery_items
    ADD CONSTRAINT file_cabinet_gallery_items_pkey PRIMARY KEY (id);


--
-- Name: file_cabinet_nodes file_cabinet_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_cabinet_nodes
    ADD CONSTRAINT file_cabinet_nodes_pkey PRIMARY KEY (id);


--
-- Name: generated_images generated_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_pkey PRIMARY KEY (id);


--
-- Name: generated_docs_media generated_docs_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_docs_media
    ADD CONSTRAINT generated_docs_media_pkey PRIMARY KEY (id);


--
-- Name: docs_article_enrichment docs_article_enrichment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_article_enrichment
    ADD CONSTRAINT docs_article_enrichment_pkey PRIMARY KEY (id);


--
-- Name: generated_videos generated_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_videos
    ADD CONSTRAINT generated_videos_pkey PRIMARY KEY (id);


--
-- Name: inventory_levels inventory_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_levels
    ADD CONSTRAINT inventory_levels_pkey PRIMARY KEY (id);


--
-- Name: inventory_reservations inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: matcher_moderation_events matcher_moderation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matcher_moderation_events
    ADD CONSTRAINT matcher_moderation_events_pkey PRIMARY KEY (id);


--
-- Name: matcher_verification_events matcher_verification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matcher_verification_events
    ADD CONSTRAINT matcher_verification_events_pkey PRIMARY KEY (id);


--
-- Name: merchant_configs merchant_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merchant_configs
    ADD CONSTRAINT merchant_configs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: news_categories news_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_categories
    ADD CONSTRAINT news_categories_pkey PRIMARY KEY (id);


--
-- Name: news_likes news_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_likes
    ADD CONSTRAINT news_likes_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news_submission_audit news_submission_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_submission_audit
    ADD CONSTRAINT news_submission_audit_pkey PRIMARY KEY (id);


--
-- Name: nft_entitlement_cache nft_entitlement_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_entitlement_cache
    ADD CONSTRAINT nft_entitlement_cache_pkey PRIMARY KEY (id);


--
-- Name: nft_gate_purchases nft_gate_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_gate_purchases
    ADD CONSTRAINT nft_gate_purchases_pkey PRIMARY KEY (id);


--
-- Name: nft_gates nft_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_gates
    ADD CONSTRAINT nft_gates_pkey PRIMARY KEY (id);


--
-- Name: nft_listings nft_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_listings
    ADD CONSTRAINT nft_listings_pkey PRIMARY KEY (id);


--
-- Name: nft_market_collections nft_market_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_market_collections
    ADD CONSTRAINT nft_market_collections_pkey PRIMARY KEY (id);


--
-- Name: nft_market_sales nft_market_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_market_sales
    ADD CONSTRAINT nft_market_sales_pkey PRIMARY KEY (id);


--
-- Name: nft_member_collections nft_member_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_member_collections
    ADD CONSTRAINT nft_member_collections_pkey PRIMARY KEY (id);


--
-- Name: nft_ownership nft_ownership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_ownership
    ADD CONSTRAINT nft_ownership_pkey PRIMARY KEY (id);


--
-- Name: nft_stakes nft_stakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nft_stakes
    ADD CONSTRAINT nft_stakes_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payout_batches payout_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_batches
    ADD CONSTRAINT payout_batches_pkey PRIMARY KEY (id);


--
-- Name: peer_game_sessions peer_game_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_game_sessions
    ADD CONSTRAINT peer_game_sessions_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: process_runs process_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_runs
    ADD CONSTRAINT process_runs_pkey PRIMARY KEY (id);


--
-- Name: product_custom_fields product_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT product_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: project_deployments project_deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_deployments
    ADD CONSTRAINT project_deployments_pkey PRIMARY KEY (id);


--
-- Name: project_orders project_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_orders
    ADD CONSTRAINT project_orders_pkey PRIMARY KEY (id);


--
-- Name: project_wallet_transactions project_wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_wallet_transactions
    ADD CONSTRAINT project_wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: project_wallets project_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_wallets
    ADD CONSTRAINT project_wallets_pkey PRIMARY KEY (id);


--
-- Name: public_pool_contributions public_pool_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_pool_contributions
    ADD CONSTRAINT public_pool_contributions_pkey PRIMARY KEY (id);


--
-- Name: public_pool_signals public_pool_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_pool_signals
    ADD CONSTRAINT public_pool_signals_pkey PRIMARY KEY (id);


--
-- Name: public_pools public_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_pools
    ADD CONSTRAINT public_pools_pkey PRIMARY KEY (id);


--
-- Name: refcodes refcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refcodes
    ADD CONSTRAINT refcodes_pkey PRIMARY KEY (id);


--
-- Name: referral_rewards referral_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: ring_contacts ring_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ring_contacts
    ADD CONSTRAINT ring_contacts_pkey PRIMARY KEY (id);


--
-- Name: schema_versions schema_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: store_orders store_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT store_orders_pkey PRIMARY KEY (id);


--
-- Name: store_user_carts store_user_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_user_carts
    ADD CONSTRAINT store_user_carts_pkey PRIMARY KEY (id);


--
-- Name: store_products store_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_products
    ADD CONSTRAINT store_products_pkey PRIMARY KEY (id);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- Name: subscription_ledger subscription_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_ledger
    ADD CONSTRAINT subscription_ledger_pkey PRIMARY KEY (id);


--
-- Name: task_escrows task_escrows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_escrows
    ADD CONSTRAINT task_escrows_pkey PRIMARY KEY (id);


--
-- Name: telegram_admin_audit telegram_admin_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_admin_audit
    ADD CONSTRAINT telegram_admin_audit_pkey PRIMARY KEY (id);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_content_interactions user_content_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_content_interactions
    ADD CONSTRAINT user_content_interactions_pkey PRIMARY KEY (id);


--
-- Name: user_device_telemetry user_device_telemetry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_device_telemetry
    ADD CONSTRAINT user_device_telemetry_pkey PRIMARY KEY (id);


--
-- Name: user_peer_games user_peer_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_peer_games
    ADD CONSTRAINT user_peer_games_pkey PRIMARY KEY (id);


--
-- Name: usernames usernames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usernames
    ADD CONSTRAINT usernames_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_profiles vendor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_profiles
    ADD CONSTRAINT vendor_profiles_pkey PRIMARY KEY (id);


--
-- Name: vendor_settlements vendor_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_settlements
    ADD CONSTRAINT vendor_settlements_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: verification_counters verification_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_counters
    ADD CONSTRAINT verification_counters_pkey PRIMARY KEY (id);


--
-- Name: verification_procedures verification_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_procedures
    ADD CONSTRAINT verification_procedures_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: wallet_access_tokens wallet_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_access_tokens
    ADD CONSTRAINT wallet_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: web_vitals web_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_vitals
    ADD CONSTRAINT web_vitals_pkey PRIMARY KEY (id);


--
-- Name: wiki_events wiki_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wiki_events
    ADD CONSTRAINT wiki_events_pkey PRIMARY KEY (id);


--
-- Name: wiki_links wiki_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wiki_links
    ADD CONSTRAINT wiki_links_pkey PRIMARY KEY (id);


--
-- Name: wiki_pages wiki_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wiki_pages
    ADD CONSTRAINT wiki_pages_pkey PRIMARY KEY (id);


--
-- Name: email_login_tokens_cleanup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_login_tokens_cleanup_idx ON public.email_login_tokens USING btree (expires_at) WHERE (used_at IS NULL);


--
-- Name: email_login_tokens_email_rate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_login_tokens_email_rate_idx ON public.email_login_tokens USING btree (email, created_at DESC) WHERE (used_at IS NULL);


--
-- Name: email_login_tokens_hash_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_login_tokens_hash_uidx ON public.email_login_tokens USING btree (token_hash);


--
-- Name: idx_account_status_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_status_audit_action ON public.account_status_audit USING btree (((data ->> 'action'::text)));


--
-- Name: idx_account_status_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_status_audit_created ON public.account_status_audit USING btree (created_at DESC);


--
-- Name: idx_account_status_audit_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_status_audit_data_gin ON public.account_status_audit USING gin (data);


--
-- Name: idx_account_status_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_status_audit_user_id ON public.account_status_audit USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_accounts_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_data_gin ON public.accounts USING gin (data);


--
-- Name: idx_accounts_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_provider ON public.accounts USING btree (((data ->> 'provider'::text)), ((data ->> 'providerAccountId'::text)));


--
-- Name: idx_accounts_provider_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_provider_account ON public.accounts USING btree (((data ->> 'provider'::text)), ((data ->> 'providerAccountId'::text)));


--
-- Name: idx_accounts_provider_account_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_accounts_provider_account_unique ON public.accounts USING btree (((data ->> 'provider'::text)), ((data ->> 'providerAccountId'::text)));


--
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_analytics_errors_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_errors_created_at ON public.analytics_errors USING btree (created_at DESC);


--
-- Name: idx_analytics_errors_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_errors_data_gin ON public.analytics_errors USING gin (data);


--
-- Name: idx_analytics_errors_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_errors_severity ON public.analytics_errors USING btree (((data ->> 'severity'::text)));


--
-- Name: idx_analytics_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at DESC);


--
-- Name: idx_analytics_events_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_data_gin ON public.analytics_events USING gin (data);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (((data ->> 'eventType'::text)));


--
-- Name: idx_analytics_events_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_session_id ON public.analytics_events USING btree (((data ->> 'sessionId'::text)));


--
-- Name: idx_certifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_created_at ON public.certifications USING btree (created_at DESC);


--
-- Name: idx_certifications_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_data_gin ON public.certifications USING gin (data);


--
-- Name: idx_certifications_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_product_id ON public.certifications USING btree (((data ->> 'productId'::text)));


--
-- Name: idx_certifications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_status ON public.certifications USING btree (((data ->> 'status'::text)));


--
-- Name: idx_certifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_type ON public.certifications USING btree (((data ->> 'type'::text)));


--
-- Name: idx_certifications_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certifications_vendor_id ON public.certifications USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_collective_order_escrows_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collective_order_escrows_data_gin ON public.collective_order_escrows USING gin (data);


--
-- Name: idx_collective_order_escrows_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collective_order_escrows_opportunity ON public.collective_order_escrows USING btree (((data ->> 'opportunityId'::text)));


--
-- Name: idx_collective_order_escrows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collective_order_escrows_status ON public.collective_order_escrows USING btree (((data ->> 'paymentStatus'::text)));


--
-- Name: idx_collective_order_escrows_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collective_order_escrows_user ON public.collective_order_escrows USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_created_at ON public.comments USING btree (created_at DESC);


--
-- Name: idx_comments_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_data_gin ON public.comments USING gin (data);


--
-- Name: idx_comments_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_entity_id ON public.comments USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_user_id ON public.comments USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_compliance_events_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_address ON public.compliance_events USING btree (((data ->> 'address'::text)));


--
-- Name: idx_compliance_events_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_data_gin ON public.compliance_events USING gin (data);


--
-- Name: idx_compliance_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_user_id ON public.compliance_events USING btree (((data ->> 'user_id'::text)));


--
-- Name: idx_conversations_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_data_gin ON public.conversations USING gin (data);


--
-- Name: idx_conversations_participants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_participants ON public.conversations USING gin (((data -> 'participants'::text)));


--
-- Name: idx_conversations_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_updated_at ON public.conversations USING btree (updated_at DESC);


--
-- Name: idx_countries_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_countries_active ON public.countries USING btree (is_active);


--
-- Name: idx_countries_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_countries_currency ON public.countries USING btree (currency_code);


--
-- Name: idx_countries_timezone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_countries_timezone ON public.countries USING btree (timezone);


--
-- Name: idx_credit_add_events_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_add_events_data_gin ON public.credit_add_events USING gin (data);


--
-- Name: idx_credit_add_events_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_credit_add_events_idempotency ON public.credit_add_events USING btree (((data ->> 'idempotency_key'::text)));


--
-- Name: idx_credit_add_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_add_events_status ON public.credit_add_events USING btree (((data ->> 'status'::text)));


--
-- Name: idx_credit_add_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_add_events_user_id ON public.credit_add_events USING btree (((data ->> 'user_id'::text)));


--
-- Name: idx_currencies_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_active ON public.currencies USING btree (is_active);


--
-- Name: idx_currencies_crypto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_crypto ON public.currencies USING btree (is_crypto);


--
-- Name: idx_delivery_zones_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_zones_active ON public.delivery_zones USING btree (((data ->> 'active'::text)));


--
-- Name: idx_delivery_zones_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_zones_data_gin ON public.delivery_zones USING gin (data);


--
-- Name: idx_delivery_zones_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_zones_region ON public.delivery_zones USING btree (((data ->> 'region'::text)));


--
-- Name: idx_desk_orders_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_desk_orders_data_gin ON public.desk_orders USING gin (data);


--
-- Name: idx_desk_orders_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_desk_orders_idempotency ON public.desk_orders USING btree (((data ->> 'idempotency_key'::text)));


--
-- Name: idx_desk_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_desk_orders_status ON public.desk_orders USING btree (((data ->> 'status'::text)));


--
-- Name: idx_desk_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_desk_orders_user_id ON public.desk_orders USING btree (((data ->> 'user_id'::text)));


--
-- Name: idx_email_api_usage_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_api_usage_data_gin ON public.email_api_usage USING gin (data);


--
-- Name: idx_email_api_usage_email_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_api_usage_email_id ON public.email_api_usage USING btree (((data ->> 'emailId'::text)));


--
-- Name: idx_email_api_usage_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_api_usage_operation ON public.email_api_usage USING btree (((data ->> 'operation'::text)));


--
-- Name: idx_email_api_usage_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_api_usage_timestamp ON public.email_api_usage USING btree (((data ->> 'timestamp'::text)));


--
-- Name: idx_email_contacts_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_contacts_data_gin ON public.email_contacts USING gin (data);


--
-- Name: idx_email_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_contacts_email ON public.email_contacts USING btree (((data ->> 'email'::text)));


--
-- Name: idx_email_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_contacts_type ON public.email_contacts USING btree (((data ->> 'type'::text)));


--
-- Name: idx_email_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_drafts_status ON public.email_drafts USING btree (((data ->> 'status'::text)));


--
-- Name: idx_email_drafts_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_drafts_thread_id ON public.email_drafts USING btree (((data ->> 'threadId'::text)));


--
-- Name: idx_email_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_messages_channel_id ON public.email_messages USING btree (((data ->> 'channelId'::text)));


--
-- Name: idx_email_messages_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_messages_data_gin ON public.email_messages USING gin (data);


--
-- Name: idx_email_messages_source_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_messages_source_channel ON public.email_messages USING btree (((data ->> 'sourceChannel'::text)));


--
-- Name: idx_email_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_messages_thread_id ON public.email_messages USING btree (((data ->> 'threadId'::text)));


--
-- Name: idx_email_tasks_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tasks_data_gin ON public.email_tasks USING gin (data);


--
-- Name: idx_email_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tasks_due_date ON public.email_tasks USING btree (((data ->> 'dueDate'::text)));


--
-- Name: idx_email_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tasks_status ON public.email_tasks USING btree (((data ->> 'status'::text)));


--
-- Name: idx_email_tasks_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_tasks_thread_id ON public.email_tasks USING btree (((data ->> 'threadId'::text)));


--
-- Name: idx_email_threads_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_channel_id ON public.email_threads USING btree (((data ->> 'channelId'::text)));


--
-- Name: idx_email_threads_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_data_gin ON public.email_threads USING gin (data);


--
-- Name: idx_email_threads_from_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_from_email ON public.email_threads USING btree (((data ->> 'fromEmail'::text)));


--
-- Name: idx_email_threads_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_last_message_at ON public.email_threads USING btree (((data ->> 'lastMessageAt'::text)));


--
-- Name: idx_email_threads_source_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_source_channel ON public.email_threads USING btree (((data ->> 'sourceChannel'::text)));


--
-- Name: INDEX idx_email_threads_source_channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_email_threads_source_channel IS 'Multi-mailbox CRM filter by human channel name';


--
-- Name: idx_email_threads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_threads_status ON public.email_threads USING btree (((data ->> 'status'::text)));


--
-- Name: idx_entities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_created_at ON public.entities USING btree (created_at DESC);


--
-- Name: idx_entities_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_data_gin ON public.entities USING gin (data);


--
-- Name: idx_entities_moderation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_moderation_status ON public.entities USING btree (((data ->> 'moderationStatus'::text)));


--
-- Name: idx_entities_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_name ON public.entities USING btree (((data ->> 'name'::text)));


--
-- Name: idx_entities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_status ON public.entities USING btree (((data ->> 'status'::text)));


--
-- Name: idx_entities_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_type ON public.entities USING btree (((data ->> 'type'::text)));


--
-- Name: idx_entities_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_user_id ON public.entities USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_entities_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_verified ON public.entities USING btree (((data ->> 'verified'::text)));


--
-- Name: idx_entity_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_reports_created_at ON public.entity_reports USING btree (created_at DESC);


--
-- Name: idx_entity_reports_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_reports_data_gin ON public.entity_reports USING gin (data);


--
-- Name: idx_entity_reports_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_reports_entity_id ON public.entity_reports USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_entity_reports_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_reports_reporter ON public.entity_reports USING btree (((data ->> 'reporterUserId'::text)));


--
-- Name: idx_entity_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_reports_status ON public.entity_reports USING btree (((data ->> 'status'::text)));


--
-- Name: idx_erp_sales_assists_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_sales_assists_data_gin ON public.erp_sales_assists USING gin (data);


--
-- Name: idx_erp_sales_assists_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_sales_assists_order_id ON public.erp_sales_assists USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_erp_sales_assists_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_sales_assists_referral_code ON public.erp_sales_assists USING btree (((data ->> 'referralCode'::text)));


--
-- Name: idx_erp_sales_assists_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_erp_sales_assists_vendor_id ON public.erp_sales_assists USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created_at ON public.events USING btree (created_at DESC);


--
-- Name: idx_events_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_data_gin ON public.events USING gin (data);


--
-- Name: idx_events_time_ms; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_time_ms ON public.events USING btree ((((data ->> 'timeMs'::text))::bigint));


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_type ON public.events USING btree (((data ->> 'type'::text)));


--
-- Name: idx_fcm_tokens_active_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_active_user ON public.fcm_tokens USING btree (((data ->> 'userId'::text))) WHERE ((data ->> 'status'::text) = 'active'::text);


--
-- Name: idx_fcm_tokens_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_created_at ON public.fcm_tokens USING btree (created_at DESC);


--
-- Name: idx_fcm_tokens_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_data_gin ON public.fcm_tokens USING gin (data);


--
-- Name: idx_fcm_tokens_data_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_data_is_active ON public.fcm_tokens USING btree ((((data ->> 'isActive'::text))::boolean));


--
-- Name: idx_fcm_tokens_data_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_data_user_id ON public.fcm_tokens USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_fcm_tokens_last_seen_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_last_seen_active ON public.fcm_tokens USING btree (((data ->> 'lastSeen'::text))) WHERE ((data ->> 'status'::text) = 'active'::text);


--
-- Name: idx_fcm_tokens_user_device; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fcm_tokens_user_device ON public.fcm_tokens USING btree (((data ->> 'userId'::text)), ((data ->> 'deviceFingerprint'::text)));


--
-- Name: idx_file_cabinet_acl_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_acl_data_gin ON public.file_cabinet_acl USING gin (data);


--
-- Name: idx_file_cabinet_acl_node_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_cabinet_acl_node_user ON public.file_cabinet_acl USING btree (((data ->> 'nodeId'::text)), ((data ->> 'userId'::text)));


--
-- Name: idx_file_cabinet_acl_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_acl_role ON public.file_cabinet_acl USING btree (((data ->> 'role'::text)));


--
-- Name: idx_file_cabinet_acl_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_acl_user ON public.file_cabinet_acl USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_file_cabinet_desktop_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_desktop_data_gin ON public.file_cabinet_desktop USING gin (data);


--
-- Name: idx_file_cabinet_desktop_user_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_cabinet_desktop_user_scope ON public.file_cabinet_desktop USING btree (((data ->> 'userId'::text)), ((data ->> 'scope'::text)));


--
-- Name: idx_file_cabinet_gallery_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_gallery_data_gin ON public.file_cabinet_gallery_items USING gin (data);


--
-- Name: idx_file_cabinet_gallery_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_gallery_node ON public.file_cabinet_gallery_items USING btree (((data ->> 'nodeId'::text)));


--
-- Name: idx_file_cabinet_gallery_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_gallery_owner ON public.file_cabinet_gallery_items USING btree (((data ->> 'ownerId'::text)));


--
-- Name: idx_file_cabinet_gallery_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_gallery_visibility ON public.file_cabinet_gallery_items USING btree (((data ->> 'visibility'::text)));


--
-- Name: idx_file_cabinet_nodes_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_data_gin ON public.file_cabinet_nodes USING gin (data);


--
-- Name: idx_file_cabinet_nodes_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_kind ON public.file_cabinet_nodes USING btree (((data ->> 'kind'::text)));


--
-- Name: idx_file_cabinet_nodes_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_owner ON public.file_cabinet_nodes USING btree (((data ->> 'ownerId'::text)));


--
-- Name: idx_file_cabinet_nodes_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_parent ON public.file_cabinet_nodes USING btree (((data ->> 'parentId'::text)));


--
-- Name: idx_file_cabinet_nodes_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_path ON public.file_cabinet_nodes USING btree (((data ->> 'path'::text)));


--
-- Name: idx_file_cabinet_nodes_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_cabinet_nodes_updated_at ON public.file_cabinet_nodes USING btree (updated_at DESC);


--
-- Name: idx_generated_images_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_actor_id ON public.generated_images USING btree (((data ->> 'actorId'::text)));


--
-- Name: idx_generated_images_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_created_at ON public.generated_images USING btree (created_at DESC);


--
-- Name: idx_generated_images_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_data_gin ON public.generated_images USING gin (data);


--
-- Name: idx_generated_images_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_provider ON public.generated_images USING btree (((data ->> 'provider'::text)));


--
-- Name: idx_generated_images_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_purpose ON public.generated_images USING btree (((data ->> 'purpose'::text)));


--
-- Name: idx_generated_images_ref_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_ref_code ON public.generated_images USING btree (((data ->> 'refCode'::text)));


--
-- Name: idx_generated_videos_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_actor_id ON public.generated_videos USING btree (((data ->> 'actorId'::text)));


--
-- Name: idx_generated_videos_clip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_clip_id ON public.generated_videos USING btree (((data ->> 'clipId'::text)));


--
-- Name: idx_generated_videos_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_created_at ON public.generated_videos USING btree (created_at DESC);


--
-- Name: idx_generated_videos_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_data_gin ON public.generated_videos USING gin (data);


--
-- Name: idx_generated_videos_generation_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_generation_kind ON public.generated_videos USING btree (((data ->> 'generationKind'::text)));


--
-- Name: idx_generated_videos_pipeline_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_pipeline_request_id ON public.generated_videos USING btree (((data ->> 'pipelineRequestId'::text)));


--
-- Name: idx_generated_videos_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_provider ON public.generated_videos USING btree (((data ->> 'provider'::text)));


--
-- Name: idx_generated_videos_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_purpose ON public.generated_videos USING btree (((data ->> 'purpose'::text)));


--
-- Name: idx_generated_videos_quality_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_quality_mode ON public.generated_videos USING btree (((data ->> 'qualityMode'::text)));


--
-- Name: idx_generated_videos_ref_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_ref_code ON public.generated_videos USING btree (((data ->> 'refCode'::text)));


--
-- Name: idx_generated_videos_remaster_from_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_remaster_from_request_id ON public.generated_videos USING btree (((data ->> 'remasterFromRequestId'::text)));


--
-- Name: idx_generated_videos_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_videos_request_id ON public.generated_videos USING btree (((data ->> 'requestId'::text)));


--
-- Name: idx_inventory_levels_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_levels_data_gin ON public.inventory_levels USING gin (data);


--
-- Name: idx_inventory_levels_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_levels_product_id ON public.inventory_levels USING btree (((data ->> 'productId'::text)));


--
-- Name: idx_inventory_levels_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_levels_store_id ON public.inventory_levels USING btree (((data ->> 'storeId'::text)));


--
-- Name: idx_inventory_reservations_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_data_gin ON public.inventory_reservations USING gin (data);


--
-- Name: idx_inventory_reservations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_expires_at ON public.inventory_reservations USING btree (((data ->> 'expiresAt'::text)));


--
-- Name: idx_inventory_reservations_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_order_id ON public.inventory_reservations USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_inventory_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservations_status ON public.inventory_reservations USING btree (((data ->> 'status'::text)));


--
-- Name: idx_likes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_likes_created_at ON public.likes USING btree (created_at DESC);


--
-- Name: idx_likes_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_likes_data_gin ON public.likes USING gin (data);


--
-- Name: idx_likes_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_likes_entity_id ON public.likes USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_likes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_likes_user_id ON public.likes USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_matcher_moderation_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_moderation_created_at ON public.matcher_moderation_events USING btree (created_at DESC);


--
-- Name: idx_matcher_moderation_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_moderation_data_gin ON public.matcher_moderation_events USING gin (data);


--
-- Name: idx_matcher_moderation_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_moderation_entity_id ON public.matcher_moderation_events USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_matcher_moderation_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_moderation_type ON public.matcher_moderation_events USING btree (((data ->> 'type'::text)));


--
-- Name: idx_matcher_verification_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_verification_created_at ON public.matcher_verification_events USING btree (created_at DESC);


--
-- Name: idx_matcher_verification_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_verification_data_gin ON public.matcher_verification_events USING gin (data);


--
-- Name: idx_matcher_verification_procedure_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_verification_procedure_number ON public.matcher_verification_events USING btree (((data ->> 'procedureNumber'::text)));


--
-- Name: idx_matcher_verification_subject_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matcher_verification_subject_type ON public.matcher_verification_events USING btree (((data ->> 'subjectType'::text)));


--
-- Name: idx_merchant_configs_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merchant_configs_data_gin ON public.merchant_configs USING gin (data);


--
-- Name: idx_merchant_configs_owner_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merchant_configs_owner_entity_id ON public.merchant_configs USING btree (((data ->> 'ownerEntityId'::text)));


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (((data ->> 'conversationId'::text)));


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_data_gin ON public.messages USING gin (data);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (((data ->> 'senderId'::text)));


--
-- Name: idx_news_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_author_id ON public.news USING btree (((data ->> 'authorId'::text)));


--
-- Name: idx_news_blog_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_blog_username ON public.news USING btree (((data ->> 'blogUsername'::text)));


--
-- Name: idx_news_categories_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_categories_data_gin ON public.news_categories USING gin (data);


--
-- Name: idx_news_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_categories_slug ON public.news_categories USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_news_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_category ON public.news USING btree (((data ->> 'category'::text)));


--
-- Name: idx_news_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_content_type ON public.news USING btree (((data ->> 'contentType'::text)));


--
-- Name: idx_news_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_created_at ON public.news USING btree (created_at DESC);


--
-- Name: idx_news_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_data_gin ON public.news USING gin (data);


--
-- Name: idx_news_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_featured ON public.news USING btree (((data ->> 'featured'::text)));


--
-- Name: idx_news_likes_news_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_likes_news_id ON public.news_likes USING btree (((data ->> 'newsId'::text)));


--
-- Name: idx_news_likes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_likes_user_id ON public.news_likes USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_news_locale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_locale ON public.news USING btree (((data ->> 'locale'::text)));


--
-- Name: idx_news_main_page_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_main_page_status ON public.news USING btree (((data ->> 'mainPageStatus'::text)));


--
-- Name: idx_news_promote_main; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_promote_main ON public.news USING btree (((data ->> 'promoteToMainPage'::text)));


--
-- Name: idx_news_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_published_at ON public.news USING btree (((data ->> 'publishedAt'::text)));


--
-- Name: idx_news_site_wide_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_site_wide_slug ON public.news USING btree (((data ->> 'siteWideSlug'::text)));


--
-- Name: idx_news_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_slug ON public.news USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_news_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_status ON public.news USING btree (((data ->> 'status'::text)));


--
-- Name: idx_news_submission_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_submission_audit_created_at ON public.news_submission_audit USING btree (created_at DESC);


--
-- Name: idx_news_submission_audit_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_submission_audit_data_gin ON public.news_submission_audit USING gin (data);


--
-- Name: idx_news_submission_audit_news_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_submission_audit_news_id ON public.news_submission_audit USING btree (((data ->> 'newsId'::text)));


--
-- Name: idx_news_translation_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_translation_group ON public.news USING btree (((data ->> 'translationGroupId'::text)));


--
-- Name: idx_news_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_visibility ON public.news USING btree (((data ->> 'visibility'::text)));


--
-- Name: idx_nft_entitlement_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_entitlement_data_gin ON public.nft_entitlement_cache USING gin (data);


--
-- Name: idx_nft_entitlement_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_entitlement_expires ON public.nft_entitlement_cache USING btree (((data ->> 'expiresAt'::text)));


--
-- Name: idx_nft_entitlement_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_entitlement_feature ON public.nft_entitlement_cache USING btree (((data ->> 'feature'::text)));


--
-- Name: idx_nft_entitlement_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_entitlement_user ON public.nft_entitlement_cache USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_nft_gate_purchases_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gate_purchases_data_gin ON public.nft_gate_purchases USING gin (data);


--
-- Name: idx_nft_gate_purchases_pay_sig; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gate_purchases_pay_sig ON public.nft_gate_purchases USING btree (((data ->> 'paySignature'::text)));


--
-- Name: idx_nft_gate_purchases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gate_purchases_status ON public.nft_gate_purchases USING btree (((data ->> 'status'::text)));


--
-- Name: idx_nft_gate_purchases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gate_purchases_user_id ON public.nft_gate_purchases USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_nft_gates_active_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gates_active_asset ON public.nft_gates USING btree (((data ->> 'activeTemplateAsset'::text)));


--
-- Name: idx_nft_gates_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gates_data_gin ON public.nft_gates USING gin (data);


--
-- Name: idx_nft_gates_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_gates_slug ON public.nft_gates USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_nft_listings_active_asset_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_nft_listings_active_asset_unique ON public.nft_listings USING btree (((data ->> 'asset'::text))) WHERE (((data ->> 'status'::text) = 'active'::text) AND ((data ->> 'chainFamily'::text) = 'solana'::text));


--
-- Name: idx_nft_listings_chain_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_chain_family ON public.nft_listings USING btree (((data ->> 'chainFamily'::text)));


--
-- Name: idx_nft_listings_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_collection ON public.nft_listings USING btree (((data ->> 'collection'::text)));


--
-- Name: idx_nft_listings_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_collection_id ON public.nft_listings USING btree (((data ->> 'collectionId'::text)));


--
-- Name: idx_nft_listings_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_created_at ON public.nft_listings USING btree (created_at DESC);


--
-- Name: idx_nft_listings_created_at_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_created_at_json ON public.nft_listings USING btree (((data ->> 'createdAt'::text)));


--
-- Name: idx_nft_listings_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_data_gin ON public.nft_listings USING gin (data);


--
-- Name: idx_nft_listings_lane; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_lane ON public.nft_listings USING btree (((data ->> 'lane'::text)));


--
-- Name: idx_nft_listings_listed_at_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_listed_at_json ON public.nft_listings USING btree (((data ->> 'listedAt'::text)));


--
-- Name: idx_nft_listings_listing_pda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_listing_pda ON public.nft_listings USING btree (((data ->> 'listingPda'::text)));


--
-- Name: idx_nft_listings_price_raw_numeric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_price_raw_numeric ON public.nft_listings USING btree (((NULLIF((data ->> 'priceRaw'::text), ''::text))::numeric));


--
-- Name: idx_nft_listings_search_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_search_text ON public.nft_listings USING gin (to_tsvector('english'::regconfig, COALESCE((data ->> 'searchText'::text), ''::text)));


--
-- Name: idx_nft_listings_seller_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_seller_user_id ON public.nft_listings USING btree (((data ->> 'sellerUserId'::text)));


--
-- Name: idx_nft_listings_seller_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_seller_username ON public.nft_listings USING btree (lower((data ->> 'sellerUsername'::text)));


--
-- Name: idx_nft_listings_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_slug ON public.nft_listings USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_nft_listings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_status ON public.nft_listings USING btree (((data ->> 'status'::text)));


--
-- Name: idx_nft_listings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_listings_user_id ON public.nft_listings USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_nft_market_collections_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_collections_active ON public.nft_market_collections USING btree (((COALESCE((data ->> 'activeListings'::text), '0'::text))::integer));


--
-- Name: idx_nft_market_collections_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_collections_collection ON public.nft_market_collections USING btree (((data ->> 'collection'::text)));


--
-- Name: idx_nft_market_collections_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_collections_data_gin ON public.nft_market_collections USING gin (data);


--
-- Name: idx_nft_market_collections_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_collections_slug ON public.nft_market_collections USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_nft_market_collections_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_collections_symbol ON public.nft_market_collections USING btree (((data ->> 'symbol'::text)));


--
-- Name: idx_nft_market_sales_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_asset ON public.nft_market_sales USING btree (((data ->> 'asset'::text)));


--
-- Name: idx_nft_market_sales_buyer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_buyer_user_id ON public.nft_market_sales USING btree (((data ->> 'buyerUserId'::text)));


--
-- Name: idx_nft_market_sales_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_data_gin ON public.nft_market_sales USING gin (data);


--
-- Name: idx_nft_market_sales_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_nft_market_sales_idempotency ON public.nft_market_sales USING btree (((data ->> 'idempotencyKey'::text)));


--
-- Name: idx_nft_market_sales_listing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_listing_id ON public.nft_market_sales USING btree (((data ->> 'listingId'::text)));


--
-- Name: idx_nft_market_sales_seller_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_seller_user_id ON public.nft_market_sales USING btree (((data ->> 'sellerUserId'::text)));


--
-- Name: idx_nft_market_sales_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_status ON public.nft_market_sales USING btree (((data ->> 'status'::text)));


--
-- Name: idx_nft_market_sales_tx_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_market_sales_tx_hash ON public.nft_market_sales USING btree (((data ->> 'txHash'::text)));


--
-- Name: idx_nft_member_collections_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_member_collections_creator ON public.nft_member_collections USING btree (((data ->> 'creatorUserId'::text)));


--
-- Name: idx_nft_member_collections_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_member_collections_data_gin ON public.nft_member_collections USING gin (data);


--
-- Name: idx_nft_member_collections_mint_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_nft_member_collections_mint_unique ON public.nft_member_collections USING btree (((data ->> 'collectionMint'::text))) WHERE (COALESCE((data ->> 'collectionMint'::text), ''::text) <> ''::text);


--
-- Name: idx_nft_member_collections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_member_collections_status ON public.nft_member_collections USING btree (((data ->> 'status'::text)));


--
-- Name: idx_nft_member_collections_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_member_collections_symbol ON public.nft_member_collections USING btree (((data ->> 'symbol'::text)));


--
-- Name: idx_nft_ownership_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_ownership_asset ON public.nft_ownership USING btree (((data ->> 'asset'::text)));


--
-- Name: idx_nft_ownership_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_ownership_data_gin ON public.nft_ownership USING gin (data);


--
-- Name: idx_nft_ownership_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_ownership_slug ON public.nft_ownership USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_nft_ownership_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_ownership_user ON public.nft_ownership USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_nft_stakes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_stakes_active ON public.nft_stakes USING btree (((data ->> 'unstakedAt'::text)));


--
-- Name: idx_nft_stakes_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_stakes_asset ON public.nft_stakes USING btree (((data ->> 'asset'::text)));


--
-- Name: idx_nft_stakes_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_stakes_data_gin ON public.nft_stakes USING gin (data);


--
-- Name: idx_nft_stakes_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_stakes_slug ON public.nft_stakes USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_nft_stakes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nft_stakes_user_id ON public.nft_stakes USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_notification_preferences_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_data_gin ON public.notification_preferences USING gin (data);


--
-- Name: idx_notification_preferences_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_updated_at ON public.notification_preferences USING btree (updated_at DESC);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_data_gin ON public.notifications USING gin (data);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (((data ->> 'read'::text)));


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (((data ->> 'type'::text)));


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_opportunities_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_category ON public.opportunities USING btree (((data ->> 'category'::text)));


--
-- Name: idx_opportunities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_created_at ON public.opportunities USING btree (created_at DESC);


--
-- Name: idx_opportunities_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_data_gin ON public.opportunities USING gin (data);


--
-- Name: idx_opportunities_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_org_id ON public.opportunities USING btree (((data ->> 'organizationId'::text)));


--
-- Name: idx_opportunities_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_priority ON public.opportunities USING btree (((data ->> 'priority'::text)));


--
-- Name: idx_opportunities_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_search ON public.opportunities USING gin (to_tsvector('english'::regconfig, ((((COALESCE((data ->> 'title'::text), ''::text) || ' '::text) || COALESCE((data ->> 'briefDescription'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'tags'::text), ''::text))));


--
-- Name: idx_opportunities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_status ON public.opportunities USING btree (((data ->> 'status'::text)));


--
-- Name: idx_opportunities_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_title ON public.opportunities USING btree (((data ->> 'title'::text)));


--
-- Name: idx_opportunities_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_type ON public.opportunities USING btree (((data ->> 'type'::text)));


--
-- Name: idx_opportunities_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_user_id ON public.opportunities USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_data_gin ON public.orders USING gin (data);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (((data ->> 'status'::text)));


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_orders_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_vendor_id ON public.orders USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_payment_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions USING btree (created_at DESC);


--
-- Name: idx_payment_transactions_order_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_transactions_order_reference ON public.payment_transactions USING btree (((data ->> 'order_reference'::text)));


--
-- Name: idx_payment_transactions_purpose_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_purpose_status ON public.payment_transactions USING btree (((data ->> 'purpose'::text)), ((data ->> 'status'::text)));


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_data_gin ON public.payments USING gin (data);


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.payments USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (((data ->> 'status'::text)));


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user_id ON public.payments USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_payout_batches_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_batches_created_at ON public.payout_batches USING btree (created_at DESC);


--
-- Name: idx_payout_batches_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_batches_data_gin ON public.payout_batches USING gin (data);


--
-- Name: idx_payout_batches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_batches_status ON public.payout_batches USING btree (((data ->> 'status'::text)));


--
-- Name: idx_pcf_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcf_category ON public.product_custom_fields USING btree (((data ->> 'category'::text)));


--
-- Name: idx_pcf_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcf_data_gin ON public.product_custom_fields USING gin (data);


--
-- Name: idx_pcf_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcf_product_id ON public.product_custom_fields USING btree (((data ->> 'product_id'::text)));


--
-- Name: idx_peer_game_sessions_challenger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_challenger ON public.peer_game_sessions USING btree (((data ->> 'challengerUserId'::text)));


--
-- Name: idx_peer_game_sessions_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_conversation ON public.peer_game_sessions USING btree (((data ->> 'conversationId'::text)));


--
-- Name: idx_peer_game_sessions_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_data_gin ON public.peer_game_sessions USING gin (data);


--
-- Name: idx_peer_game_sessions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_message ON public.peer_game_sessions USING btree (((data ->> 'messageId'::text)));


--
-- Name: idx_peer_game_sessions_peer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_peer ON public.peer_game_sessions USING btree (((data ->> 'peerUserId'::text)));


--
-- Name: idx_peer_game_sessions_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_slug ON public.peer_game_sessions USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_peer_game_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_status ON public.peer_game_sessions USING btree (((data ->> 'status'::text)));


--
-- Name: idx_peer_game_sessions_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peer_game_sessions_updated_at ON public.peer_game_sessions USING btree (updated_at DESC);


--
-- Name: idx_platform_settings_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_settings_data_gin ON public.platform_settings USING gin (data);


--
-- Name: idx_process_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_runs_created_at ON public.process_runs USING btree (created_at DESC);


--
-- Name: idx_process_runs_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_runs_data_gin ON public.process_runs USING gin (data);


--
-- Name: idx_process_runs_pipeline_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_runs_pipeline_id ON public.process_runs USING btree (((data ->> 'pipelineId'::text)));


--
-- Name: idx_process_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_runs_status ON public.process_runs USING btree (((data ->> 'status'::text)));


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (((data ->> 'category'::text)));


--
-- Name: idx_products_certified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_certified ON public.products USING btree (((data ->> 'certified'::text)));


--
-- Name: idx_products_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_created_at ON public.products USING btree (created_at DESC);


--
-- Name: idx_products_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_data_gin ON public.products USING gin (data);


--
-- Name: idx_products_has_promotions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_has_promotions ON public.products USING btree (jsonb_array_length(COALESCE((data -> 'promotions'::text), '[]'::jsonb)));


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_price ON public.products USING btree ((((data -> 'price'::text))::numeric));


--
-- Name: idx_products_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_search ON public.products USING gin (to_tsvector('english'::regconfig, ((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'tags'::text), ''::text))));


--
-- Name: idx_products_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_vendor_id ON public.products USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_project_deployments_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_deployments_data_gin ON public.project_deployments USING gin (data);


--
-- Name: idx_project_deployments_edge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_deployments_edge ON public.project_deployments USING btree (((data ->> 'edge'::text)));


--
-- Name: idx_project_deployments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_project_deployments_order_id ON public.project_deployments USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_project_deployments_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_deployments_updated_at ON public.project_deployments USING btree (updated_at DESC);


--
-- Name: idx_project_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_created_at ON public.project_orders USING btree (created_at DESC);


--
-- Name: idx_project_orders_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_data_gin ON public.project_orders USING gin (data);


--
-- Name: idx_project_orders_integrator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_integrator_id ON public.project_orders USING btree (((data ->> 'integratorId'::text)));


--
-- Name: idx_project_orders_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_opportunity_id ON public.project_orders USING btree (((data ->> 'opportunityId'::text)));


--
-- Name: idx_project_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_payment_status ON public.project_orders USING btree (((data ->> 'paymentStatus'::text)));


--
-- Name: idx_project_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_user_id ON public.project_orders USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_project_orders_work_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_orders_work_status ON public.project_orders USING btree (((data ->> 'workStatus'::text)));


--
-- Name: idx_public_pool_contrib_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_contrib_data_gin ON public.public_pool_contributions USING gin (data);


--
-- Name: idx_public_pool_contrib_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_public_pool_contrib_idempotency ON public.public_pool_contributions USING btree (((data ->> 'clone_id'::text)), ((data ->> 'idempotency_key'::text)));


--
-- Name: idx_public_pool_contrib_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_contrib_pool ON public.public_pool_contributions USING btree (((data ->> 'clone_id'::text)), ((data ->> 'pool_id'::text)));


--
-- Name: idx_public_pool_contrib_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_contrib_status ON public.public_pool_contributions USING btree (((data ->> 'pool_id'::text)), ((data ->> 'status'::text)));


--
-- Name: idx_public_pool_contrib_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_contrib_user ON public.public_pool_contributions USING btree (((data ->> 'clone_id'::text)), ((data ->> 'user_id'::text)));


--
-- Name: idx_public_pool_signals_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_signals_data_gin ON public.public_pool_signals USING gin (data);


--
-- Name: idx_public_pool_signals_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_signals_pool ON public.public_pool_signals USING btree (((data ->> 'clone_id'::text)), ((data ->> 'pool_id'::text)));


--
-- Name: idx_public_pool_signals_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pool_signals_user ON public.public_pool_signals USING btree (((data ->> 'clone_id'::text)), ((data ->> 'pool_id'::text)), ((data ->> 'user_id'::text)));


--
-- Name: idx_public_pools_clone_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pools_clone_kind_status ON public.public_pools USING btree (((data ->> 'clone_id'::text)), ((data ->> 'pool_kind'::text)), ((data ->> 'status'::text)));


--
-- Name: idx_public_pools_clone_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_public_pools_clone_slug ON public.public_pools USING btree (((data ->> 'clone_id'::text)), ((data ->> 'pool_slug'::text)));


--
-- Name: idx_public_pools_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_pools_data_gin ON public.public_pools USING gin (data);


--
-- Name: idx_pw_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pw_data_gin ON public.project_wallets USING gin (data);


--
-- Name: idx_pw_user_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pw_user_project ON public.project_wallets USING btree (((data ->> 'global_user_id'::text)), ((data ->> 'project_slug'::text)));


--
-- Name: idx_pwt_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pwt_data_gin ON public.project_wallet_transactions USING gin (data);


--
-- Name: idx_pwt_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pwt_timestamp ON public.project_wallet_transactions USING btree (((data ->> 'timestamp'::text)) DESC);


--
-- Name: idx_pwt_user_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pwt_user_project ON public.project_wallet_transactions USING btree (((data ->> 'global_user_id'::text)), ((data ->> 'project_slug'::text)));


--
-- Name: idx_refcodes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refcodes_code ON public.refcodes USING btree (((data ->> 'code'::text)));


--
-- Name: idx_refcodes_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refcodes_data_gin ON public.refcodes USING gin (data);


--
-- Name: idx_refcodes_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refcodes_owner_user_id ON public.refcodes USING btree (((data ->> 'ownerUserId'::text)));


--
-- Name: idx_refcodes_wallet_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refcodes_wallet_address ON public.refcodes USING btree (((data ->> 'walletAddress'::text)));


--
-- Name: idx_referral_rewards_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_rewards_data_gin ON public.referral_rewards USING gin (data);


--
-- Name: idx_referral_rewards_order_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_referral_rewards_order_reference ON public.referral_rewards USING btree (((data ->> 'orderReference'::text)));


--
-- Name: idx_referral_rewards_referrer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_rewards_referrer_user_id ON public.referral_rewards USING btree (((data ->> 'referrerUserId'::text)));


--
-- Name: idx_referral_rewards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_rewards_status ON public.referral_rewards USING btree (((data ->> 'status'::text)));


--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_data_gin ON public.reviews USING gin (data);


--
-- Name: idx_reviews_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_entity_id ON public.reviews USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree ((((data -> 'rating'::text))::numeric));


--
-- Name: idx_reviews_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_ring_contacts_contact_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ring_contacts_contact_user ON public.ring_contacts USING btree (((data ->> 'contact_user_id'::text)));


--
-- Name: idx_ring_contacts_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ring_contacts_data_gin ON public.ring_contacts USING gin (data);


--
-- Name: idx_ring_contacts_favorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ring_contacts_favorite ON public.ring_contacts USING btree (((data ->> 'owner_user_id'::text)), ((data ->> 'project_slug'::text)), ((data ->> 'is_favorite'::text)));


--
-- Name: idx_ring_contacts_owner_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ring_contacts_owner_project ON public.ring_contacts USING btree (((data ->> 'owner_user_id'::text)), ((data ->> 'project_slug'::text)));


--
-- Name: idx_ring_contacts_owner_project_contact_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ring_contacts_owner_project_contact_unique ON public.ring_contacts USING btree (((data ->> 'owner_user_id'::text)), ((data ->> 'project_slug'::text)), ((data ->> 'contact_user_id'::text)));


--
-- Name: idx_sessions_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_data_gin ON public.sessions USING gin (data);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (((data ->> 'expires'::text)));


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (((data ->> 'sessionToken'::text)));


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_settlements_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_data_gin ON public.settlements USING gin (data);


--
-- Name: idx_settlements_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_order_id ON public.settlements USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_settlements_scheduled_for; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_scheduled_for ON public.settlements USING btree (((data ->> 'scheduledFor'::text)));


--
-- Name: idx_settlements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_status ON public.settlements USING btree (((data ->> 'status'::text)));


--
-- Name: idx_settlements_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_vendor_id ON public.settlements USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_stock_movements_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_data_gin ON public.stock_movements USING gin (data);


--
-- Name: idx_stock_movements_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_order_id ON public.stock_movements USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_stock_movements_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (((data ->> 'productId'::text)));


--
-- Name: idx_store_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_orders_created_at ON public.store_orders USING btree (created_at DESC);


--
-- Name: idx_store_orders_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_orders_data_gin ON public.store_orders USING gin (data);


--
-- Name: idx_store_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_orders_status ON public.store_orders USING btree (((data ->> 'status'::text)));


--
-- Name: idx_store_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_orders_user_id ON public.store_orders USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_store_orders_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_orders_vendor_id ON public.store_orders USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_store_user_carts_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_user_carts_data_gin ON public.store_user_carts USING gin (data);


--
-- Name: idx_store_user_carts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_user_carts_user_id ON public.store_user_carts USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_store_products_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_approval_status ON public.store_products USING btree (((data ->> 'approvalStatus'::text)));


--
-- Name: idx_store_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_category ON public.store_products USING btree (((data ->> 'category'::text)));


--
-- Name: idx_store_products_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_created_at ON public.store_products USING btree (created_at DESC);


--
-- Name: idx_store_products_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_data_gin ON public.store_products USING gin (data);


--
-- Name: idx_store_products_has_promotions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_has_promotions ON public.store_products USING btree (jsonb_array_length(COALESCE((data -> 'promotions'::text), '[]'::jsonb)));


--
-- Name: idx_store_products_list_stores; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_list_stores ON public.store_products USING gin (((data -> 'listStores'::text)));


--
-- Name: idx_store_products_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_price ON public.store_products USING btree ((((data -> 'price'::text))::numeric));


--
-- Name: idx_store_products_rep; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_rep ON public.store_products USING btree (((data ->> 'rep'::text)));


--
-- Name: INDEX idx_store_products_rep; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_store_products_rep IS 'Lookup products by assigned representative username';


--
-- Name: idx_store_products_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_search ON public.store_products USING gin (to_tsvector('english'::regconfig, ((((COALESCE((data ->> 'name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'description'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'tags'::text), ''::text))));


--
-- Name: idx_store_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_status ON public.store_products USING btree (((data ->> 'status'::text)));


--
-- Name: idx_store_products_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_products_vendor_id ON public.store_products USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_store_settings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_settings_id ON public.store_settings USING btree (id);


--
-- Name: idx_subscription_ledger_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_created ON public.subscription_ledger USING btree (created_at DESC);


--
-- Name: idx_subscription_ledger_credit_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_credit_due ON public.subscription_ledger USING btree (((data ->> 'provider'::text)), ((data ->> 'status'::text)), ((data ->> 'next_payment_due'::text))) WHERE ((data ->> 'provider'::text) = 'credit_balance'::text);


--
-- Name: idx_subscription_ledger_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_data_gin ON public.subscription_ledger USING gin (data);


--
-- Name: idx_subscription_ledger_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_due ON public.subscription_ledger USING btree (((data ->> 'next_payment_due'::text)));


--
-- Name: idx_subscription_ledger_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_method ON public.subscription_ledger USING btree (((data ->> 'method'::text)));


--
-- Name: idx_subscription_ledger_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_provider ON public.subscription_ledger USING btree (((data ->> 'provider'::text)));


--
-- Name: idx_subscription_ledger_provider_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_provider_status ON public.subscription_ledger USING btree (((data ->> 'provider'::text)), ((data ->> 'status'::text)));


--
-- Name: idx_subscription_ledger_solana_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_solana_tx ON public.subscription_ledger USING btree (((data ->> 'solana_tx_signature'::text))) WHERE ((data ->> 'solana_tx_signature'::text) IS NOT NULL);


--
-- Name: idx_subscription_ledger_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_status ON public.subscription_ledger USING btree (((data ->> 'status'::text)));


--
-- Name: idx_subscription_ledger_stripe_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_stripe_sub ON public.subscription_ledger USING btree (((data ->> 'stripe_subscription_id'::text))) WHERE ((data ->> 'stripe_subscription_id'::text) IS NOT NULL);


--
-- Name: idx_subscription_ledger_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_user_id ON public.subscription_ledger USING btree (((data ->> 'user_id'::text)));


--
-- Name: idx_subscription_ledger_wfp_rec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_ledger_wfp_rec ON public.subscription_ledger USING btree (((data ->> 'wayforpay_rec_token'::text))) WHERE ((data ->> 'wayforpay_rec_token'::text) IS NOT NULL);


--
-- Name: idx_task_escrows_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_escrows_data_gin ON public.task_escrows USING gin (data);


--
-- Name: idx_task_escrows_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_escrows_message ON public.task_escrows USING btree (((data ->> 'messageId'::text)));


--
-- Name: idx_task_escrows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_escrows_status ON public.task_escrows USING btree (((data ->> 'paymentStatus'::text)));


--
-- Name: idx_telegram_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_audit_created_at ON public.telegram_admin_audit USING btree (created_at DESC);


--
-- Name: idx_telegram_audit_parsed_intent_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_audit_parsed_intent_gin ON public.telegram_admin_audit USING gin (parsed_intent);


--
-- Name: idx_telegram_audit_telegram_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_audit_telegram_id ON public.telegram_admin_audit USING btree (telegram_id);


--
-- Name: idx_telegram_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_audit_user_id ON public.telegram_admin_audit USING btree (user_id);


--
-- Name: idx_uci_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uci_action ON public.user_content_interactions USING btree (((data ->> 'action'::text)));


--
-- Name: idx_uci_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uci_data_gin ON public.user_content_interactions USING gin (data);


--
-- Name: idx_uci_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uci_target ON public.user_content_interactions USING btree (((data ->> 'targetType'::text)), ((data ->> 'targetId'::text)));


--
-- Name: idx_uci_unique_action; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_uci_unique_action ON public.user_content_interactions USING btree (((data ->> 'userId'::text)), ((data ->> 'targetType'::text)), ((data ->> 'targetId'::text)), ((data ->> 'action'::text)));


--
-- Name: idx_uci_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uci_user ON public.user_content_interactions USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_user_addresses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_created_at ON public.user_addresses USING btree (created_at DESC);


--
-- Name: idx_user_addresses_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_data_gin ON public.user_addresses USING gin (data);


--
-- Name: idx_user_addresses_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_is_default ON public.user_addresses USING btree (((data ->> 'isDefault'::text)));


--
-- Name: idx_user_addresses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_user_device_telemetry_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_device_telemetry_data_gin ON public.user_device_telemetry USING gin (data);


--
-- Name: idx_user_device_telemetry_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_device_telemetry_device_id ON public.user_device_telemetry USING btree (((data ->> 'deviceId'::text)));


--
-- Name: idx_user_device_telemetry_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_device_telemetry_domain ON public.user_device_telemetry USING btree (((data ->> 'domain'::text)));


--
-- Name: idx_user_device_telemetry_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_device_telemetry_updated ON public.user_device_telemetry USING btree (updated_at DESC);


--
-- Name: idx_user_device_telemetry_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_device_telemetry_user_id ON public.user_device_telemetry USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_user_peer_games_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_peer_games_data_gin ON public.user_peer_games USING gin (data);


--
-- Name: idx_user_peer_games_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_peer_games_owner ON public.user_peer_games USING btree (((data ->> 'ownerId'::text)));


--
-- Name: idx_user_peer_games_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_peer_games_username ON public.user_peer_games USING btree (((data ->> 'username'::text)));


--
-- Name: idx_user_peer_games_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_peer_games_visibility ON public.user_peer_games USING btree (((data ->> 'visibility'::text)));


--
-- Name: idx_usernames_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usernames_confirmed ON public.usernames USING btree (((data ->> 'confirmed'::text)));


--
-- Name: idx_usernames_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usernames_data_gin ON public.usernames USING gin (data);


--
-- Name: idx_usernames_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usernames_expires_at ON public.usernames USING btree (((data ->> 'expiresAt'::text)));


--
-- Name: idx_usernames_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usernames_user_id ON public.usernames USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_data_gin ON public.users USING gin (data);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (((data ->> 'email'::text)));


--
-- Name: idx_users_email_unique_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email_unique_lower ON public.users USING btree (lower((data ->> 'email'::text))) WHERE (((data ->> 'email'::text) IS NOT NULL) AND (btrim((data ->> 'email'::text)) <> ''::text));


--
-- Name: INDEX idx_users_email_unique_lower; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_users_email_unique_lower IS 'One platform user per normalized email; Google sub lives in accounts.providerAccountId';


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (((data ->> 'role'::text)));


--
-- Name: idx_users_telegram_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_telegram_id ON public.users USING btree ((((data -> 'communication'::text) ->> 'telegramId'::text)));


--
-- Name: idx_vendor_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_created_at ON public.vendor_profiles USING btree (created_at DESC);


--
-- Name: idx_vendor_profiles_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_data_gin ON public.vendor_profiles USING gin (data);


--
-- Name: idx_vendor_profiles_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_entity_id ON public.vendor_profiles USING btree (((data ->> 'entityId'::text)));


--
-- Name: idx_vendor_profiles_onboarding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_onboarding_status ON public.vendor_profiles USING btree (((data ->> 'onboardingStatus'::text)));


--
-- Name: idx_vendor_profiles_promo_free_ship_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_promo_free_ship_mode ON public.vendor_profiles USING btree (((((data -> 'promotions'::text) -> 'freeShipping'::text) ->> 'mode'::text)));


--
-- Name: idx_vendor_profiles_promo_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_promo_offer ON public.vendor_profiles USING btree ((((data -> 'promotions'::text) ->> 'checkoutSpecialOfferEnabled'::text)));


--
-- Name: INDEX idx_vendor_profiles_promo_offer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_vendor_profiles_promo_offer IS 'Vendor checkout special-offer / free-shipping promotions (JSONB path)';


--
-- Name: idx_vendor_profiles_trust_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_trust_level ON public.vendor_profiles USING btree (((data ->> 'trustLevel'::text)));


--
-- Name: idx_vendor_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_profiles_user_id ON public.vendor_profiles USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_vendor_settlements_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_settlements_data_gin ON public.vendor_settlements USING gin (data);


--
-- Name: idx_vendor_settlements_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_settlements_order_id ON public.vendor_settlements USING btree (((data ->> 'orderId'::text)));


--
-- Name: idx_vendor_settlements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_settlements_status ON public.vendor_settlements USING btree (((data ->> 'status'::text)));


--
-- Name: idx_vendor_settlements_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_settlements_vendor_id ON public.vendor_settlements USING btree (((data ->> 'vendorId'::text)));


--
-- Name: idx_vendors_certified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_certified ON public.vendors USING btree (((data ->> 'certified'::text)));


--
-- Name: idx_vendors_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_created_at ON public.vendors USING btree (created_at DESC);


--
-- Name: idx_vendors_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_data_gin ON public.vendors USING gin (data);


--
-- Name: idx_vendors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_user_id ON public.vendors USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_vendors_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_verified ON public.vendors USING btree (((data ->> 'verified'::text)));


--
-- Name: idx_verification_procedures_applicant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_applicant ON public.verification_procedures USING btree (((data ->> 'applicantUserId'::text)));


--
-- Name: idx_verification_procedures_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_created_at ON public.verification_procedures USING btree (created_at DESC);


--
-- Name: idx_verification_procedures_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_data_gin ON public.verification_procedures USING gin (data);


--
-- Name: idx_verification_procedures_procedure_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_procedure_number ON public.verification_procedures USING btree (((data ->> 'procedureNumber'::text)));


--
-- Name: idx_verification_procedures_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_status ON public.verification_procedures USING btree (((data ->> 'status'::text)));


--
-- Name: idx_verification_procedures_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_subject_id ON public.verification_procedures USING btree (((data ->> 'subjectId'::text)));


--
-- Name: idx_verification_procedures_subject_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_procedures_subject_type ON public.verification_procedures USING btree (((data ->> 'subjectType'::text)));


--
-- Name: idx_verification_tokens_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tokens_data_gin ON public.verification_tokens USING gin (data);


--
-- Name: idx_verification_tokens_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tokens_lookup ON public.verification_tokens USING btree (((data ->> 'identifier'::text)), ((data ->> 'token'::text)));


--
-- Name: idx_vt_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vt_data_gin ON public.verification_tokens USING gin (data);


--
-- Name: idx_vt_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vt_identifier ON public.verification_tokens USING btree (((data ->> 'identifier'::text)));


--
-- Name: idx_vt_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vt_token ON public.verification_tokens USING btree (((data ->> 'token'::text)));


--
-- Name: idx_wallet_tx_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_created_at ON public.wallet_transactions USING btree (created_at DESC);


--
-- Name: idx_wallet_tx_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_data_gin ON public.wallet_transactions USING gin (data);


--
-- Name: idx_wallet_tx_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_status ON public.wallet_transactions USING btree (((data ->> 'status'::text)));


--
-- Name: idx_wallet_tx_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_type ON public.wallet_transactions USING btree (((data ->> 'type'::text)));


--
-- Name: idx_wallet_tx_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_user_id ON public.wallet_transactions USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_wallet_tx_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_tx_wallet_id ON public.wallet_transactions USING btree (((data ->> 'walletId'::text)));


--
-- Name: idx_wat_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wat_data_gin ON public.wallet_access_tokens USING gin (data);


--
-- Name: idx_wat_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wat_expires_at ON public.wallet_access_tokens USING btree (((data ->> 'expiresAt'::text)));


--
-- Name: idx_wat_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wat_status ON public.wallet_access_tokens USING btree (((data ->> 'status'::text)));


--
-- Name: idx_wat_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wat_token_hash ON public.wallet_access_tokens USING btree (((data ->> 'tokenHash'::text)));


--
-- Name: idx_wat_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wat_user_id ON public.wallet_access_tokens USING btree (((data ->> 'userId'::text)));


--
-- Name: idx_web_vitals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_vitals_created_at ON public.web_vitals USING btree (created_at DESC);


--
-- Name: idx_web_vitals_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_vitals_data_gin ON public.web_vitals USING gin (data);


--
-- Name: idx_web_vitals_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_vitals_session_id ON public.web_vitals USING btree (((data ->> 'sessionId'::text)));


--
-- Name: idx_wiki_events_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_events_at ON public.wiki_events USING btree (((data ->> 'at'::text)) DESC);


--
-- Name: idx_wiki_events_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_events_data_gin ON public.wiki_events USING gin (data);


--
-- Name: idx_wiki_events_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_events_page_id ON public.wiki_events USING btree (((data ->> 'pageId'::text)));


--
-- Name: idx_wiki_events_vault_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_events_vault_key ON public.wiki_events USING btree (((data ->> 'vaultKey'::text)));


--
-- Name: idx_wiki_links_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_links_data_gin ON public.wiki_links USING gin (data);


--
-- Name: idx_wiki_links_from_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_links_from_id ON public.wiki_links USING btree (((data ->> 'fromId'::text)));


--
-- Name: idx_wiki_links_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_links_to_id ON public.wiki_links USING btree (((data ->> 'toId'::text)));


--
-- Name: idx_wiki_links_to_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_links_to_slug ON public.wiki_links USING btree (((data ->> 'toSlug'::text)));


--
-- Name: idx_wiki_links_to_vault; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_links_to_vault ON public.wiki_links USING btree (((data ->> 'toVaultKey'::text)));


--
-- Name: idx_wiki_pages_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_data_gin ON public.wiki_pages USING gin (data);


--
-- Name: idx_wiki_pages_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_fts ON public.wiki_pages USING gin (to_tsvector('english'::regconfig, ((((((COALESCE((data ->> 'title'::text), ''::text) || ' '::text) || COALESCE((data ->> 'bodyMarkdown'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'path'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text))));


--
-- Name: idx_wiki_pages_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_kind ON public.wiki_pages USING btree (((data ->> 'kind'::text)));


--
-- Name: idx_wiki_pages_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_path ON public.wiki_pages USING btree (((data ->> 'path'::text)));


--
-- Name: idx_wiki_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_slug ON public.wiki_pages USING btree (((data ->> 'slug'::text)));


--
-- Name: idx_wiki_pages_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_updated_at ON public.wiki_pages USING btree (updated_at DESC);


--
-- Name: idx_wiki_pages_vault_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wiki_pages_vault_key ON public.wiki_pages USING btree (((data ->> 'vaultKey'::text)));


--
-- Name: idx_wiki_pages_vault_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wiki_pages_vault_slug ON public.wiki_pages USING btree (((data ->> 'vaultKey'::text)), ((data ->> 'slug'::text)));


--
-- Name: conversations notify_conversations_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_conversations_change AFTER INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.notify_change();


--
-- Name: messages notify_messages_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_messages_change AFTER INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_change();


--
-- Name: notifications notify_notifications_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_notifications_change AFTER INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_change();


--
-- Name: opportunities notify_opportunities_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_opportunities_change AFTER INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.notify_change();


--
-- Name: payments notify_payments_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_payments_change AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_change();


--
-- Name: certifications update_certifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON public.certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comments update_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: countries update_countries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: currencies update_currencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: delivery_zones update_delivery_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: entities update_entities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fcm_tokens update_fcm_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fcm_tokens_updated_at BEFORE UPDATE ON public.fcm_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: likes update_likes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_likes_updated_at BEFORE UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: news_categories update_news_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_news_categories_updated_at BEFORE UPDATE ON public.news_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: news update_news_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: nft_listings update_nft_listings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_nft_listings_updated_at BEFORE UPDATE ON public.nft_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: opportunities update_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reviews update_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: store_orders update_store_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON public.store_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: store_user_carts update_store_user_carts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_user_carts_updated_at BEFORE UPDATE ON public.store_user_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: store_products update_store_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON public.store_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: store_settings update_store_settings_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_settings_timestamp_trigger BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.update_store_settings_timestamp();


--
-- Name: usernames update_usernames_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usernames_updated_at BEFORE UPDATE ON public.usernames FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendor_profiles update_vendor_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendor_profiles_updated_at BEFORE UPDATE ON public.vendor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: wallet_transactions update_wallet_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wallet_transactions_updated_at BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_login_tokens email_login_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_login_tokens
    ADD CONSTRAINT email_login_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: telegram_admin_audit telegram_admin_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_admin_audit
    ADD CONSTRAINT telegram_admin_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

-- ============================================================================
-- Seed data (reference + meta)
-- ============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Homebrew)

SET client_encoding = 'UTF8';

--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('UA', 'Ukraine', '🇺🇦', 'Europe/Kyiv', '+380', 'UAH', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('US', 'United States', '🇺🇸', 'America/New_York', '+1', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('GB', 'United Kingdom', '🇬🇧', 'Europe/London', '+44', 'GBP', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CA', 'Canada', '🇨🇦', 'America/Toronto', '+1', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AU', 'Australia', '🇦🇺', 'Australia/Sydney', '+61', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('DE', 'Germany', '🇩🇪', 'Europe/Berlin', '+49', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('FR', 'France', '🇫🇷', 'Europe/Paris', '+33', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('ES', 'Spain', '🇪🇸', 'Europe/Madrid', '+34', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('IT', 'Italy', '🇮🇹', 'Europe/Rome', '+39', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('NL', 'Netherlands', '🇳🇱', 'Europe/Amsterdam', '+31', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('BE', 'Belgium', '🇧🇪', 'Europe/Brussels', '+32', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AT', 'Austria', '🇦🇹', 'Europe/Vienna', '+43', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CH', 'Switzerland', '🇨🇭', 'Europe/Zurich', '+41', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('PL', 'Poland', '🇵🇱', 'Europe/Warsaw', '+48', 'PLN', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CZ', 'Czech Republic', '🇨🇿', 'Europe/Prague', '+420', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('SK', 'Slovakia', '🇸🇰', 'Europe/Bratislava', '+421', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('HU', 'Hungary', '🇭🇺', 'Europe/Budapest', '+36', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('RO', 'Romania', '🇷🇴', 'Europe/Bucharest', '+40', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('BG', 'Bulgaria', '🇧🇬', 'Europe/Sofia', '+359', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('GR', 'Greece', '🇬🇷', 'Europe/Athens', '+30', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('TR', 'Turkey', '🇹🇷', 'Europe/Istanbul', '+90', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('PT', 'Portugal', '🇵🇹', 'Europe/Lisbon', '+351', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('SE', 'Sweden', '🇸🇪', 'Europe/Stockholm', '+46', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('NO', 'Norway', '🇳🇴', 'Europe/Oslo', '+47', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('DK', 'Denmark', '🇩🇰', 'Europe/Copenhagen', '+45', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('FI', 'Finland', '🇫🇮', 'Europe/Helsinki', '+358', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('IE', 'Ireland', '🇮🇪', 'Europe/Dublin', '+353', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('LT', 'Lithuania', '🇱🇹', 'Europe/Vilnius', '+370', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('LV', 'Latvia', '🇱🇻', 'Europe/Riga', '+371', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('EE', 'Estonia', '🇪🇪', 'Europe/Tallinn', '+372', 'EUR', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('MD', 'Moldova', '🇲🇩', 'Europe/Chisinau', '+373', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('BY', 'Belarus', '🇧🇾', 'Europe/Minsk', '+375', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('GE', 'Georgia', '🇬🇪', 'Asia/Tbilisi', '+995', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AM', 'Armenia', '🇦🇲', 'Asia/Yerevan', '+374', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AZ', 'Azerbaijan', '🇦🇿', 'Asia/Baku', '+994', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('KZ', 'Kazakhstan', '🇰🇿', 'Asia/Almaty', '+7', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('UZ', 'Uzbekistan', '🇺🇿', 'Asia/Tashkent', '+998', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('JP', 'Japan', '🇯🇵', 'Asia/Tokyo', '+81', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('KR', 'South Korea', '🇰🇷', 'Asia/Seoul', '+82', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CN', 'China', '🇨🇳', 'Asia/Shanghai', '+86', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('IN', 'India', '🇮🇳', 'Asia/Kolkata', '+91', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('SG', 'Singapore', '🇸🇬', 'Asia/Singapore', '+65', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('TH', 'Thailand', '🇹🇭', 'Asia/Bangkok', '+66', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('VN', 'Vietnam', '🇻🇳', 'Asia/Ho_Chi_Minh', '+84', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('MY', 'Malaysia', '🇲🇾', 'Asia/Kuala_Lumpur', '+60', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('ID', 'Indonesia', '🇮🇩', 'Asia/Jakarta', '+62', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('PH', 'Philippines', '🇵🇭', 'Asia/Manila', '+63', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AE', 'United Arab Emirates', '🇦🇪', 'Asia/Dubai', '+971', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('SA', 'Saudi Arabia', '🇸🇦', 'Asia/Riyadh', '+966', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('IL', 'Israel', '🇮🇱', 'Asia/Jerusalem', '+972', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('EG', 'Egypt', '🇪🇬', 'Africa/Cairo', '+20', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('ZA', 'South Africa', '🇿🇦', 'Africa/Johannesburg', '+27', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('NG', 'Nigeria', '🇳🇬', 'Africa/Lagos', '+234', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('KE', 'Kenya', '🇰🇪', 'Africa/Nairobi', '+254', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('MA', 'Morocco', '🇲🇦', 'Africa/Casablanca', '+212', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('BR', 'Brazil', '🇧🇷', 'America/Sao_Paulo', '+55', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('MX', 'Mexico', '🇲🇽', 'America/Mexico_City', '+52', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('AR', 'Argentina', '🇦🇷', 'America/Argentina/Buenos_Aires', '+54', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CL', 'Chile', '🇨🇱', 'America/Santiago', '+56', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('CO', 'Colombia', '🇨🇴', 'America/Bogota', '+57', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('PE', 'Peru', '🇵🇪', 'America/Lima', '+51', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');
INSERT INTO public.countries (code, name, flag, timezone, phone_code, currency_code, is_active, created_at, updated_at) VALUES ('NZ', 'New Zealand', '🇳🇿', 'Pacific/Auckland', '+64', 'USD', true, '2026-07-24 00:09:46.907979+03', '2026-07-24 00:09:46.907979+03');


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('UAH', 'Ukrainian Hryvnia', '₴', 2, false, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('USD', 'United States Dollar', '$', 2, false, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('EUR', 'Euro', '€', 2, false, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('GBP', 'British Pound', '£', 2, false, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('PLN', 'Polish Zloty', 'zł', 2, false, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('RNG', 'Ring Token', 'RING', 4, true, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('DAAR', 'Daar Token', 'DAAR', 4, true, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_crypto, is_active, created_at, updated_at) VALUES ('DAARION', 'Daarion Token', 'DAARION', 4, true, true, '2026-07-24 00:09:46.907514+03', '2026-07-24 00:09:46.907514+03');


--
-- Data for Name: news_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.news_categories (id, data, created_at, updated_at) VALUES ('announcements', '{"icon": "📢", "name": "Announcements", "slug": "announcements", "color": "bg-yellow-500", "description": "Official announcements"}', '2026-07-24 00:09:58.529683+03', '2026-07-24 00:09:58.529683+03');
INSERT INTO public.news_categories (id, data, created_at, updated_at) VALUES ('platform-updates', '{"icon": "🚀", "name": "Platform Updates", "slug": "platform-updates", "color": "bg-blue-500", "description": "Platform and infrastructure updates"}', '2026-07-24 00:09:58.529683+03', '2026-07-24 00:09:58.529683+03');
INSERT INTO public.news_categories (id, data, created_at, updated_at) VALUES ('community', '{"icon": "👥", "name": "Community", "slug": "community", "color": "bg-purple-500", "description": "Community highlights"}', '2026-07-24 00:09:58.529683+03', '2026-07-24 00:09:58.529683+03');
INSERT INTO public.news_categories (id, data, created_at, updated_at) VALUES ('security', '{"icon": "🛡️", "name": "Security", "slug": "security", "color": "bg-red-500", "description": "Security advisories"}', '2026-07-24 00:09:58.529683+03', '2026-07-24 00:09:58.529683+03');
INSERT INTO public.news_categories (id, data, created_at, updated_at) VALUES ('blogs', '{"icon": "✍️", "name": "Blogs", "slug": "blogs", "color": "bg-teal-500", "description": "Member blog posts promoted to main news"}', '2026-07-24 00:09:58.529683+03', '2026-07-24 00:09:58.529683+03');


--
-- Data for Name: schema_versions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('4.0.0', 'Unified schema: merged core tables from scripts/postgres-schema.sql, fixed payments to JSONB, added usernames, added LISTEN/NOTIFY', '2026-07-24 00:09:46.903801+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('4.0.3-fcm-jsonb', 'fcm_tokens JSONB schema with userId+deviceFingerprint unique index', '2026-07-24 00:09:58.980018+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('017', 'Ring analytics: analytics_events, web_vitals, analytics_errors', '2026-07-24 00:09:59.001272+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('018', 'Generative media: generated_images + generated_videos (ImageConductor / VideoConductor)', '2026-07-24 00:09:59.025117+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('019', 'Per-project wallet: project_wallet_contacts, project_wallets, project_wallet_transactions', '2026-07-24 00:09:59.051575+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('020', 'Ring contacts: ring_contacts collection for user-linked address book', '2026-07-24 00:09:59.076165+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('021', 'Drop legacy project_wallet_contacts (migrated to ring_contacts)', '2026-07-24 00:09:59.104797+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('022', 'Phase 2: desk_orders, credit_add_events, compliance_events', '2026-07-24 00:09:59.148674+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('023', 'User device telemetry: user_device_telemetry JSONB snapshots', '2026-07-24 00:09:59.174817+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('024', 'Account status audit: account_status_audit JSONB', '2026-07-24 00:09:59.202359+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('025', 'Subscription ledger: subscription_ledger JSONB SSOT for multi-provider subscriptions', '2026-07-24 00:09:59.234145+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('037', 'Auth tables PRIMARY KEY + unique provider/providerAccountId on accounts', '2026-07-24 00:09:59.547543+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('043', 'Peer games: peer_game_sessions + user_peer_games JSONB collections', '2026-07-24 00:09:59.712105+03', 'ring_user');
INSERT INTO public.schema_versions (version, description, applied_at, applied_by) VALUES ('045', '045_docs_media_and_enrichment: generated_docs_media + docs_article_enrichment', '2026-08-04 00:00:00+03', 'ring_user');


--
-- Data for Name: store_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.store_settings (id, value, updated_at, created_at) VALUES ('price_range', '{"maxPrice": 3000, "minPrice": 0}', '2026-07-24 00:09:46.907248+03', '2026-07-24 00:09:46.907248+03');


--
-- PostgreSQL database dump complete
--

-- ============================================================================
-- Privileges (idempotent for typical local/prod app roles)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ring_user') THEN
    GRANT USAGE ON SCHEMA public TO ring_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ring_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ring_user;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ring_user;
  END IF;
END $$;

INSERT INTO schema_versions (version, description)
SELECT '4.1.0',
       'Flattened SSOT: schema.sql absorbs migrations through 043 + 2026-06-13 notification_preferences'
WHERE NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = '4.1.0');
