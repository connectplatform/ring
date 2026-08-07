# Ring Tunnel — Channel Naming Contract

## User inbox (per-user delivery)

Published server-side via `publishToUserTunnel(userId, channel, data)`.

| Channel | Publisher | Client subscribe |
|---------|-----------|------------------|
| `notifications:unread` | `notification-service` | `useSync` / `useUnreadCount` |
| `notifications:inbox` | `notification-service` | `useTunnelChannel({ channel: 'notifications:inbox', userScoped: false })` |
| `credit:balance` | `creditBalanceService` | `useTunnelChannel({ channel: 'credit:balance', userScoped: false })` |
| `account:status` | `app/_actions/admin-account-status.ts` | `GlobalTunnelListeners` → `AccountStatusTunnelListener` → `useTunnelChannel({ channel: 'account:status', userScoped: false })` |
| `telemetry:{domain}` | `/api/tunnel/telemetry` | `useRealtimeData` |

**Rule:** Subscribe to the **base channel name**. User scoping is enforced by server delivery (`TunnelHub.publishToUser`), not by suffixing `:userId` on the client.

`TunnelProvider` also dispatches to `${channel}:${userId}` when `message.metadata.userId` matches the session (legacy compatibility).

## Topic channels (fan-out)

Published via `publishToChannel(channel, event, data)`.

Examples: `conversation:{id}`, `matcher`, `presence` (public).

## Transport paths

- **Path A (SSOT):** `TunnelProvider` → `useTunnel` → `useTunnelChannel`
- **Path C (fallback):** HTTP polling via `useSync` when WSS disconnected

## FCM boundary

- **Tunnel:** in-app live session (`notifications:inbox`, telemetry) — no third-party push.
- **FCM:** `NotificationChannel.PUSH` only when user opts into push and app is offline/background.

## Bidirectional data

- **Notifications inbox:** primarily server → client; read/delete events echoed on `notifications:inbox`.
- **Telemetry:** client uplink via `tunnel.publish('telemetry:uplink', 'sample', message)` or `POST /api/tunnel/telemetry`; downlink on `telemetry:{domain}`.

## Channel ACL (`lib/tunnel/channel-acl.ts`)

Shared policy for **HTTP** (`/api/tunnel/subscribe`, `/api/tunnel/publish`) and **native WSS** frames. Trusted Node publishers (`publishToUserTunnel` / server `publishToChannel`) bypass this.

| Channel family | Subscribe | Client publish |
|----------------|-----------|----------------|
| `game:{sessionId}` | Auth + `peer_game_sessions` participant | Same (e.g. `game:dc-signal`) |
| `game:{id}:spectate` | Denied (deferred) | Denied |
| `credit:balance`, `notifications:*`, `wallet:list`, `account:status` | Authenticated | **Denied** (server inbox only) |
| `credit:balance:{userId}` (and same for notifications/wallet/account) | Owner only | Denied |
| Other topics (`matcher`, `conversation:*`, …) | Guests OK | Authenticated only |

Guest tokens: `POST /api/tunnel/token` reuses httpOnly cookie `ring_tunnel_anon` for a stable `anon-*` id until Auth.js sign-in issues a member token.
