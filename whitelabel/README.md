# Whitelabel runtime helpers

Install-time clone identity, branding, theme, navigation, hero, and feature flags live in **`ring-config.json`** at the project root (merged with `ring-config.template.json`).

Access via `@/lib/ring-config-core` (client + server) or `@/lib/ring-config` (server, cached).

## Runtime admin overrides

SuperAdmin branding changes persist to **`platform_settings`** (`branding` namespace) and overlay the ring-config snapshot at runtime. No filesystem writes.

## `features.ts`

Server feature guards (`isFeatureEnabledOnServer`) read from the unified config layer.

## Retired paths

- `whitelabel/instance.config.json` — removed; use `ring-config.json`
- `whitelabel/examples/default.json` — merged into `ring-config.template.json`
