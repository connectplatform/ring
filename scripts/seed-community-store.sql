-- ============================================================================
-- seed-community-store.sql
-- Local seed: vendor entities + 4 community marketplace products for ring-platform.org
-- Users: unicorn, cto (created), ray
-- Visibility: listStores=['1'], approvalStatus=approved, status=active
-- ============================================================================

BEGIN;

-- CTO user (missing in local DB)
INSERT INTO users (id, data, created_at, updated_at) VALUES (
  'seed-cto-hromada-0001',
  jsonb_build_object(
    'id', 'seed-cto-hromada-0001',
    'email', 'cto@hromada.app',
    'username', 'cto',
    'name', 'Hromada CTO',
    'displayName', 'Hromada CTO',
    'role', 'subscriber',
    'isVerified', true,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  data = users.data || jsonb_build_object('username', 'cto', 'email', 'cto@hromada.app'),
  updated_at = NOW();

-- UNICORN vendor entity + profile
INSERT INTO entities (id, data, created_at, updated_at) VALUES (
  'entity_vendor_unicorn',
  jsonb_build_object(
    'id', 'entity_vendor_unicorn',
    'name', 'Unicorn LegioX Store',
    'description', 'Premium LegioX skillsets and Ring AI tooling',
    'addedBy', 'a71fd5d0-708d-4c9e-8e70-da4f7ffef446',
    'modifiedBy', 'a71fd5d0-708d-4c9e-8e70-da4f7ffef446',
    'category', 'vendor',
    'type', 'vendor-store',
    'storeActivated', true,
    'storeStatus', 'open',
    'storeSlug', 'unicorn',
    'storeCategories', '["commerce","education"]'::jsonb,
    'vendorTier', 'NEW',
    'commission', 20,
    'dateAdded', NOW(),
    'lastUpdated', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

INSERT INTO vendor_profiles (id, data, created_at, updated_at) VALUES (
  'vendor_entity_vendor_unicorn',
  jsonb_build_object(
    'id', 'vendor_entity_vendor_unicorn',
    'entityId', 'entity_vendor_unicorn',
    'userId', 'a71fd5d0-708d-4c9e-8e70-da4f7ffef446',
    'onboardingStatus', 'approved',
    'onboardingStartedAt', NOW(),
    'onboardingCompletedAt', NOW(),
    'storeName', 'Unicorn LegioX Store',
    'trustLevel', 'NEW',
    'trustScore', 50,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

UPDATE users SET
  data = jsonb_set(COALESCE(data, '{}'::jsonb), '{role}', '"subscriber,vendor"'),
  updated_at = NOW()
WHERE id = 'a71fd5d0-708d-4c9e-8e70-da4f7ffef446';

-- CTO vendor entity + profile
INSERT INTO entities (id, data, created_at, updated_at) VALUES (
  'entity_vendor_cto',
  jsonb_build_object(
    'id', 'entity_vendor_cto',
    'name', 'Hromada Promptor School',
    'description', 'Ring-powered governance and prompt education',
    'addedBy', 'seed-cto-hromada-0001',
    'modifiedBy', 'seed-cto-hromada-0001',
    'category', 'vendor',
    'type', 'vendor-store',
    'storeActivated', true,
    'storeStatus', 'open',
    'storeSlug', 'hromada-promptor',
    'storeCategories', '["education"]'::jsonb,
    'vendorTier', 'NEW',
    'commission', 20,
    'dateAdded', NOW(),
    'lastUpdated', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

INSERT INTO vendor_profiles (id, data, created_at, updated_at) VALUES (
  'vendor_entity_vendor_cto',
  jsonb_build_object(
    'id', 'vendor_entity_vendor_cto',
    'entityId', 'entity_vendor_cto',
    'userId', 'seed-cto-hromada-0001',
    'onboardingStatus', 'approved',
    'onboardingStartedAt', NOW(),
    'onboardingCompletedAt', NOW(),
    'storeName', 'Hromada Promptor School',
    'trustLevel', 'NEW',
    'trustScore', 50,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

UPDATE users SET
  data = jsonb_set(COALESCE(data, '{}'::jsonb), '{role}', '"subscriber,vendor"'),
  updated_at = NOW()
WHERE id = 'seed-cto-hromada-0001';

-- RAY vendor entity + profile
INSERT INTO entities (id, data, created_at, updated_at) VALUES (
  'entity_vendor_ray',
  jsonb_build_object(
    'id', 'entity_vendor_ray',
    'name', 'Ring Community Store',
    'description', 'Free OSS community kits for Ring Platform collaboration and showcase',
    'addedBy', '4ceceeb0-562b-46cc-acb8-c5ab44547834',
    'modifiedBy', '4ceceeb0-562b-46cc-acb8-c5ab44547834',
    'category', 'vendor',
    'type', 'vendor-store',
    'storeActivated', true,
    'storeStatus', 'open',
    'storeSlug', 'ring-community',
    'storeCategories', '["other","mvm","commerce"]'::jsonb,
    'vendorTier', 'PREMIUM',
    'commission', 12,
    'dateAdded', NOW(),
    'lastUpdated', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

INSERT INTO vendor_profiles (id, data, created_at, updated_at) VALUES (
  'vendor_entity_vendor_ray',
  jsonb_build_object(
    'id', 'vendor_entity_vendor_ray',
    'entityId', 'entity_vendor_ray',
    'userId', '4ceceeb0-562b-46cc-acb8-c5ab44547834',
    'onboardingStatus', 'approved',
    'onboardingStartedAt', NOW(),
    'onboardingCompletedAt', NOW(),
    'storeName', 'Ring Community Store',
    'trustLevel', 'PREMIUM',
    'trustScore', 90,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

-- Products (main store visible)
INSERT INTO store_products (id, data, created_at, updated_at) VALUES
(
  'prod_legiox_premium_plugin',
  jsonb_build_object(
    'id', 'prod_legiox_premium_plugin',
    'name', 'LegioX Premium Skillsets Cursor Plugin',
    'slug', 'legiox-premium-skillsets-plugin',
    'description', 'Premium LegioX truth-lens skillsets for Cursor — Ring-powered AI development.',
    'price', 49,
    'currency', 'USD',
    'category', 'commerce',
    'stock', 9999,
    'status', 'active',
    'vendorId', 'entity_vendor_unicorn',
    'entity_id', 'entity_vendor_unicorn',
    'vendor_id', 'a71fd5d0-708d-4c9e-8e70-da4f7ffef446',
    'vendorName', 'Unicorn LegioX Store',
    'digitalProduct', true,
    'instantDelivery', true,
    'listStores', '["1"]'::jsonb,
    'productListedAt', '["1"]'::jsonb,
    'approvalStatus', 'approved',
    'mainStoreStatus', 'active',
    'images', '[]'::jsonb,
    'tags', '["legiox","cursor","skillsets","ai"]'::jsonb,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
),
(
  'prod_hromada_promptor_course',
  jsonb_build_object(
    'id', 'prod_hromada_promptor_course',
    'name', 'Hromada Promptor School Course',
    'slug', 'hromada-promptor-school-course',
    'description', 'Learn Ring-powered governance and prompt engineering at Hromada Academy.',
    'price', 199,
    'currency', 'USD',
    'category', 'education',
    'stock', 9999,
    'status', 'active',
    'vendorId', 'entity_vendor_cto',
    'entity_id', 'entity_vendor_cto',
    'vendor_id', 'seed-cto-hromada-0001',
    'vendorName', 'Hromada Promptor School',
    'digitalProduct', true,
    'instantDelivery', true,
    'listStores', '["1"]'::jsonb,
    'approvalStatus', 'approved',
    'mainStoreStatus', 'active',
    'images', '[]'::jsonb,
    'tags', '["hromada","education","prompt"]'::jsonb,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
),
(
  'prod_ring_oss_starter_kit',
  jsonb_build_object(
    'id', 'prod_ring_oss_starter_kit',
    'name', 'Ring Platform OSS Self-Host Starter Kit',
    'slug', 'ring-oss-self-host-starter',
    'description', 'Free community guide + templates to self-host ring-platform.org from github.com/connectplatform/ring.',
    'price', 0,
    'currency', 'USD',
    'category', 'other',
    'stock', 9999,
    'status', 'active',
    'vendorId', 'entity_vendor_ray',
    'entity_id', 'entity_vendor_ray',
    'vendor_id', '4ceceeb0-562b-46cc-acb8-c5ab44547834',
    'vendorName', 'Ring Community Store',
    'digitalProduct', true,
    'instantDelivery', true,
    'featured', true,
    'listStores', '["1"]'::jsonb,
    'approvalStatus', 'approved',
    'mainStoreStatus', 'active',
    'images', '[]'::jsonb,
    'tags', '["oss","community","self-host","ring-platform"]'::jsonb,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
),
(
  'prod_ring_integrations_showcase',
  jsonb_build_object(
    'id', 'prod_ring_integrations_showcase',
    'name', 'Ring Integrations & Collaboration Showcase Pack',
    'slug', 'ring-integrations-showcase-pack',
    'description', 'Free MCP connectors, integration templates, and collaboration patterns for Ring tech showcase.',
    'price', 0,
    'currency', 'USD',
    'category', 'mvm',
    'stock', 9999,
    'status', 'active',
    'vendorId', 'entity_vendor_ray',
    'entity_id', 'entity_vendor_ray',
    'vendor_id', '4ceceeb0-562b-46cc-acb8-c5ab44547834',
    'vendorName', 'Ring Community Store',
    'digitalProduct', true,
    'instantDelivery', true,
    'featured', true,
    'listStores', '["1"]'::jsonb,
    'approvalStatus', 'approved',
    'mainStoreStatus', 'active',
    'images', '[]'::jsonb,
    'tags', '["mcp","integrations","showcase","collaboration"]'::jsonb,
    'createdAt', NOW(),
    'updatedAt', NOW()
  ),
  NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

COMMIT;
