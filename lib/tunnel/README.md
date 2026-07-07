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
