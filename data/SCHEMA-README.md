# Ring Platform - PostgreSQL Schema

**Version**: 3.0.0  
**Last Updated**: 2025-02-04  
**Database**: `ring_platform`

---

## Overview

Unified comprehensive PostgreSQL schema for Ring Platform multi-vendor marketplace. Designed for:
- **Fresh installations** - One-command setup for any Ring clone
- **Multi-vendor marketplace** - Products, vendors, orders, certifications
- **JSONB document model** - Firebase-compatible, flexible schema
- **Reference data** - Currencies, countries, timezones, phone codes
- **Performance-optimized** - GIN indexes, full-text search, caching
- **Production-ready** - Payment tracking, vendor management, analytics

---

## Quick Start

### For Docker PostgreSQL (ring-postgres-dev)

```bash
# Create new database for fresh Ring clone
docker exec ring-postgres-dev psql -U ring_user -d postgres \
  -c 'CREATE DATABASE ring_your_clone;'

# Run unified schema (all tables in one command)
docker exec -i ring-postgres-dev psql -U ring_user -d ring_your_clone \
  < data/schema.sql

# Or use the helper script:
./scripts/run-migration.sh data/schema.sql
```

### For Native PostgreSQL

```bash
psql -U your_user -d your_database < data/schema.sql
```

---

## Tables (15 total)

### Reference Data Tables

| Table | Purpose | Model |
|-------|---------|-------|
| `currencies` | ISO 4217 currencies and crypto tokens | Columnar |
| `countries` | ISO 3166-1 countries with timezones, phone codes | Columnar |

### Core Tables

| Table | Purpose | Model |
|-------|---------|-------|
| `users` | User accounts with profile, preferences, credit balance | JSONB |
| `schema_versions` | Schema migration tracking | Columnar |

### Marketplace Tables (Multi-vendor Store)

| Table | Purpose | Model |
|-------|---------|-------|
| `products` | Marketplace products from vendors | JSONB |
| `vendors` | Marketplace sellers and businesses | JSONB |
| `vendor_profiles` | Extended vendor management & trust scores | JSONB |
| `orders` | Customer marketplace purchases | JSONB |
| `certifications` | Quality certifications & badges | JSONB |
| `delivery_zones` | Regional delivery availability | JSONB |

### Ring Portal Store Tables

| Table | Purpose | Model |
|-------|---------|-------|
| `store_products` | Ring Portal Store items (hosting, hardware, courses) | JSONB |
| `store_orders` | Ring Portal Store purchases | JSONB |
| `store_settings` | Performance cache (price ranges, filters) | JSONB |
| `payments` | WayForPay membership upgrade tracking | Columnar |

### Content Tables

| Table | Purpose | Model |
|-------|---------|-------|
| `news` | Ring Platform news and content articles | JSONB |

---

## Reference Data

### Currencies (8 seeded)

| Code | Name | Symbol | Type |
|------|------|--------|------|
| UAH | Ukrainian Hryvnia | ₴ | Fiat |
| USD | United States Dollar | $ | Fiat |
| EUR | Euro | € | Fiat |
| GBP | British Pound | £ | Fiat |
| PLN | Polish Zloty | zł | Fiat |
| RING | Ring Token | RING | Crypto |
| DAAR | Daar Token | DAAR | Crypto |
| DAARION | Daarion Token | DAARION | Crypto |

### Countries (62 seeded)

Core markets with timezone, phone code, and default currency:

- **Europe**: Ukraine, Germany, France, UK, Poland, Netherlands, etc.
- **Americas**: USA, Canada, Brazil, Mexico, Argentina, etc.
- **Asia-Pacific**: Japan, Korea, Singapore, Australia, etc.
- **Middle East/Africa**: UAE, Israel, South Africa, Nigeria, etc.

---

## Key Features

### 1. JSONB Document Model
- **Firebase-compatible** - Easy migration from Firestore
- **Flexible schema** - No ALTER TABLE needed for new fields
- **GIN indexes** - Fast JSONB queries

### 2. Full-Text Search
```sql
-- Products search index
CREATE INDEX idx_products_search ON products 
USING GIN (to_tsvector('english', 
    COALESCE(data->>'name', '') || ' ' || 
    COALESCE(data->>'description', '') || ' ' || 
    COALESCE(data->>'tags', '')
));

-- Usage:
SELECT * FROM products 
WHERE to_tsvector('english', 
  COALESCE(data->>'name', '') || ' ' || 
  COALESCE(data->>'description', '')
) @@ to_tsquery('english', 'organic & coffee');
```

### 3. Performance Cache (store_settings)
```sql
-- Cache key: 'price_range'
-- Value: {"minPrice": 0, "maxPrice": 2400, "productCount": 457}
-- Expiry: 1 hour (checked by API)
-- Auto-refreshes on stale data
```

**Usage:**
```typescript
// In /api/store/price-range
const cached = await db.find('store_settings', { id: 'price_range' })
if (cached && cacheAge < 3600000) {
  return cached.value // 95% faster!
}
```

### 4. Automatic Timestamps
```sql
-- All tables have updated_at trigger
-- Automatically updates on every UPDATE query
-- No manual timestamp management needed
```

### 5. Reference Data Access
```typescript
// Query currencies
const currencies = await db.query('currencies', { is_active: true });

// Query countries for dropdown
const countries = await db.query('countries', { is_active: true });

// Get country by code
const ukraine = await db.findById('countries', 'UA');
// { code: 'UA', name: 'Ukraine', timezone: 'Europe/Kyiv', phone_code: '+380' }
```

---

## Docker Helper Script

**Location**: `scripts/run-migration.sh`

**Usage:**
```bash
# Make executable (if needed)
chmod +x scripts/run-migration.sh

# Run any migration
./scripts/run-migration.sh data/schema.sql
./scripts/run-migration.sh scripts/add-new-feature.sql
```

**Script automatically:**
- Finds correct container (`ring-postgres-dev`)
- Uses correct user (`ring_user`)
- Uses correct database
- Handles errors gracefully
- Shows clear success/failure messages

---

## Common Docker PostgreSQL Commands

### Database Operations
```bash
# List all databases
docker exec ring-postgres-dev psql -U ring_user -d postgres -c '\l'

# List all tables
docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c '\dt'

# Describe table structure
docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c '\d currencies'

# Table sizes
docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size('public.'||tablename) DESC;"
```

### Query Operations
```bash
# View currencies
docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c \
  "SELECT code, name, symbol, is_crypto FROM currencies;"

# View countries
docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c \
  "SELECT code, name, timezone, phone_code FROM countries WHERE is_active = TRUE LIMIT 10;"

# Interactive session
docker exec -it ring-postgres-dev psql -U ring_user -d ring_platform
```

### Migration Operations
```bash
# Run migration from file
docker exec -i ring-postgres-dev psql -U ring_user -d ring_platform \
  < scripts/your-migration.sql

# Backup database
docker exec ring-postgres-dev pg_dump -U ring_user ring_platform \
  > backups/ring_platform_$(date +%Y%m%d).sql

# Restore database
docker exec -i ring-postgres-dev psql -U ring_user -d ring_platform \
  < backups/ring_platform_20250204.sql
```

---

## Schema Updates

When adding new features:

1. **Option A: Update unified schema** (recommended for major features)
   ```bash
   # Edit data/schema.sql
   # Add new table/indexes
   # Increment schema version
   # Run migration
   ./scripts/run-migration.sh data/schema.sql
   ```

2. **Option B: Create separate migration** (for incremental changes)
   ```bash
   # Create scripts/add-feature-X.sql
   # Run migration
   ./scripts/run-migration.sh scripts/add-feature-X.sql
   # Then integrate into data/schema.sql for future installations
   ```

---

## Troubleshooting

### "Command not found: psql"
**Problem**: PostgreSQL runs in Docker, not on host  
**Solution**: Use Docker commands or `scripts/run-migration.sh`

### "Role postgres does not exist"
**Problem**: Wrong user (container uses `ring_user`, not `postgres`)  
**Solution**: Always use `-U ring_user`

### "Database does not exist"
**Problem**: Trying to run migration on non-existent database  
**Solution**: Create database first:
```bash
docker exec ring-postgres-dev psql -U ring_user -d postgres \
  -c 'CREATE DATABASE your_db_name;'
```

### "Permission denied"
**Problem**: User doesn't have necessary permissions  
**Solution**: Schema includes GRANT commands for `ring_user` and `greenfood_user`

---

## Related Files

- `data/schema.sql` - **Unified comprehensive schema (USE THIS)**
- `data/countries.ts` - TypeScript country data with timezones
- `scripts/postgres-schema.sql` - Ring Platform core schema (reference)
- `scripts/run-migration.sh` - Docker migration helper

---

## For Ring Clone Deployments

**One-command fresh installation:**
```bash
# 1. Create database
docker exec ring-postgres-dev psql -U ring_user -d postgres \
  -c 'CREATE DATABASE ring_your_clone;'

# 2. Run unified schema
docker exec -i ring-postgres-dev psql -U ring_user -d ring_your_clone \
  < data/schema.sql

# Done! 15 tables created, reference data seeded, indexes built!
```

**Result:**
- All tables created (15 total)
- Reference data seeded (currencies, countries)
- All indexes built
- All triggers configured
- Store cache seeded
- Schema version tracked
- Permissions granted
- Ready for production!

---

**Legiox Commander - Ring Platform Schema v3.0.0**
