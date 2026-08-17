# Ring Platform - PostgreSQL Schema

**Version**: 4.1.0 (flattened SSOT)  
**Last Updated**: 2026-08-10  
**Database**: `ring_platform` (clones use `ring_<slug>`)

---

## Overview

Unified comprehensive PostgreSQL schema for Ring Platform. **Fresh installs apply this file only** — numbered files under `data/migrations/` are incremental history for existing DBs and for re-flattening.

- **Fresh installations** — `./install.sh setup-db` or `./scripts/setup-clone-db.sh`
- **Rebuild SSOT** — from `ring/web`: `npm run db:flatten-schema` (scripts resolve **`ring/web/data`**, Final-Split)
- JSONB document model, reference currencies/countries, PostGIS-ready
- `048_news_jsonb_fts`: expression FTS GIN on title+excerpt+content + unique `data.wpPostId` for WP-import clones

---

## Quick Start

### Flattened install (recommended)

```bash
./install.sh setup-db --clone-name yourclone --db-name ring_yourclone --create-role
# or
./scripts/setup-clone-db.sh --db-name ring_yourclone --db-user ring_user
```

### Docker PostgreSQL (ring-postgres-dev)

```bash
docker exec ring-postgres-dev psql -U ring_user -d postgres \
  -c 'CREATE DATABASE ring_your_clone;'

docker exec -i ring-postgres-dev psql -U ring_user -d ring_your_clone \
  < data/schema.sql
```

---

## Related Files

- `data/schema.sql` — **Unified flattened schema (USE THIS for new DBs)**
- `data/migrations/` — Incremental patches for existing DBs + flatten input
- `scripts/setup-clone-db.sh` — Create DB/role + apply schema
- `scripts/flatten-schema-from-migrations.sh` — Rebuild schema.sql from migrations
- `scripts/run-migration.sh` — Docker helper for ad-hoc SQL

---

**Legiox Commander - Ring Platform Schema v4.1.0**
