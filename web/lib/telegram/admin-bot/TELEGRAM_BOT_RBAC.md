# Telegram Admin Bot — RBAC Policy

## Role SSOT

All bot authorization uses helpers from `features/auth/user-role.ts`:

| Helper | Roles | Use |
|--------|-------|-----|
| `PLATFORM_ADMIN_ROLES` | `admin`, `superadmin` | Whitelist gate, news approval notifications |
| `isPlatformAdmin(role)` | `admin`, `superadmin` | Most destructive/mutating API executor paths |
| `isSuperadmin(role)` | `superadmin` only | User delete, platform settings mutations |

## Layers

1. **Webhook** — Telegram sender must map to a Ring user in `whitelist.ts` (`PLATFORM_ADMIN_ROLES`).
2. **Ring API executor** (`ring-api-executor.ts`) — operation-level checks before HTTP calls to Ring APIs.
3. **Ring HTTP APIs** — session/MCP auth re-validates; bot tokens must not bypass SSOT.

## Strict operations (superadmin)

- `delete` on `users`
- Platform branding / AI settings (mirrors `/api/admin/platform-settings`, `/api/admin/save`)

## Platform admin operations

- News moderation, bulk publish, category admin routes
- Order status overrides, wallet credit balance reads
- Verification queue review (via `assertVerificationAdmin` in verification services)

## News visibility

Bot-initiated news flows respect `news-permissions.ts` and `news-visibility-filter.ts` the same as web UI.
