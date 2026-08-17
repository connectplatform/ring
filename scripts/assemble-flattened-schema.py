#!/usr/bin/env python3
"""Assemble data/schema.sql from pg_dump DDL + seed dumps (flatten migrations)."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # ring/
WEB = ROOT / "web"
DDL = Path("/tmp/ring-schema-ddl.sql")
SEEDS = Path("/tmp/ring-schema-seeds.sql")
OUT = Path(__import__("os").environ.get("RING_SCHEMA_OUT", str(WEB / "data" / "schema.sql")))

SKIP_PREFIXES = (
    "-- Dumped by",
    "-- Dumped on",
    "-- Started on",
    "-- Completed on",
    "\\restrict",
    "\\unrestrict",
)


def clean(text: str) -> list[str]:
    out: list[str] = []
    for line in text.splitlines():
        if line.startswith(SKIP_PREFIXES):
            continue
        if line.startswith("SELECT pg_catalog.set_config"):
            continue
        if line.startswith("SET ") and "search_path" not in line and "client_encoding" not in line:
            continue
        out.append(line)
    return out


def main() -> None:
    ddl_lines = clean(DDL.read_text())
    seed_lines = clean(SEEDS.read_text()) if SEEDS.exists() else []

    body = "\n".join(ddl_lines).strip() + "\n"
    # Drop dump CREATE EXTENSION — header owns them
    body = re.sub(r"(?m)^CREATE EXTENSION[^\n]*\n(?:COMMENT ON EXTENSION[^\n]*\n)?", "", body)
    # public schema always exists on fresh DBs
    body = re.sub(r"(?m)^CREATE SCHEMA public;\n", "", body)
    body = re.sub(r"(?m)^ALTER SCHEMA public OWNER TO [^;]+;\n", "", body)
    body = re.sub(r"(?m)^COMMENT ON SCHEMA public[^\n]*\n", "", body)

    header = f"""-- ============================================================================
-- PostgreSQL Schema for Ring Platform (flattened SSOT)
-- ============================================================================
-- Version: 4.1.0
-- Date: {date.today().isoformat()}
-- Source: prior schema.sql + data/migrations/*.sql (skips legacy 001_email_crm_schema.sql)
-- Fresh installs: apply THIS FILE ONLY (install.sh setup-db / scripts/setup-clone-db.sh).
-- Existing DBs: add incremental files under data/migrations/, then re-run flatten.
-- Rebuild: scripts/flatten-schema-from-migrations.sh
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

"""

    footer = """
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
       'Flattened SSOT: schema.sql absorbs migrations through 048_news_jsonb_fts + prior'
WHERE NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = '4.1.0');
"""

    seeds_block = (
        "\n-- ============================================================================\n"
        "-- Seed data (reference + meta)\n"
        "-- ============================================================================\n\n"
        + "\n".join(seed_lines).strip()
        + "\n"
        if seed_lines
        else "\n"
    )

    final = header + body + seeds_block + footer
    OUT.write_text(final)
    tables = len(re.findall(r"(?m)^CREATE TABLE ", final))
    print(f"wrote {OUT} lines={len(final.splitlines())} tables={tables}")
    for needle in ("project_orders", "email_contacts", "fcm_tokens", "peer_game_sessions", "wiki_pages"):
        print(f"  has {needle}: {needle in final}")


if __name__ == "__main__":
    main()
