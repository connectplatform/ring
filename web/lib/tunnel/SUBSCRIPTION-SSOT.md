# Tunnel subscription SSOT — removed deprecated code

> Machine SSOT: `lib/tunnel/channel-subscription-registry.ts`, `hooks/use-tunnel-channel.ts`  
> Human doc: `docs/en/features/tunnel-protocol.mdx`  
> Removed: 2026-06-22 (subscription dedup campaign)

## Removed exports (`hooks/use-tunnel.ts`)

| Removed | Reason | Superseded by |
|---------|--------|---------------|
| `useTunnelNotifications()` | Effect deps included `subscribe`; re-subscribed on every TunnelProvider context identity change → duplicate `/api/tunnel/subscribe` calls | `useTunnelChannel({ channel: 'notifications:inbox', onMessage })` — see `hooks/use-notifications.ts`, `hooks/use-realtime.ts` |
| `useTunnelMessages(channel)` | Same effect-churn pattern; bypassed provider dedup race guard before registry SSOT | `useTunnelChannel({ channel, onTunnelMessage })` for event streams; production chat uses `hooks/use-messaging.ts` (`useMessages`, `useTyping`) |
| `useTunnelPresence(channel)` | Direct `subscribe()` in effect with `[isConnected, subscribe]` deps | `useTunnelChannel({ channel: 'presence', onTunnelMessage })` — see `hooks/use-realtime.ts` `useRealtimePresence()` |

## Removed patterns (inline in components / hooks)

| Location | Removed pattern | Superseded by |
|----------|-----------------|---------------|
| `components/tunnel/tunnel-demo.tsx` | `useTunnelNotifications`, `useTunnelMessages`, manual `useEffect` + `subscribe()` | `useTunnelChannel` with stable `useCallback` handlers |
| `hooks/use-realtime.ts` `useRealtimeMessages` | `useTunnelMessages(channel)` | `useTunnelChannel` + `useTunnel().publish` for outbound |
| `hooks/use-messaging.ts` | `useEffect` + `subscribe(channel, inlineHandler)` | `useTunnelChannel({ onTunnelMessage })` |
| `hooks/use-realtime-opportunities.ts` | `tunnel.subscribe('opportunities', …)` in effect | `useTunnelChannel({ channel: 'opportunities' })` |
| `hooks/use-sync.ts` | `subscribe` in effect dependency array | `subscribeRef` — effect deps `[enabled, tunnelChannel, tunnelEnabled, tunnelConnected]` only |

## Transport-layer SSOT (not removed — consolidated)

| Module | Role |
|--------|------|
| `lib/tunnel/channel-subscription-registry.ts` | One transport subscribe per channel; pending-promise guard; multi-handler dispatch |
| `components/providers/tunnel-provider.tsx` | App-wide registry instance; progressive connect |
| `hooks/use-tunnel-channel.ts` | App hook SSOT: `subscribeRef`, `onMessageRef`, `onTunnelMessage`; deps `[resolvedChannel, isConnected]` |

## Provider mount order (2026-06-23)

**Rule:** Every tunnel consumer (`useTunnelChannel`, `useCreditBalance`, `AccountStatusTunnelListener`, …) must be a **descendant of `TunnelProvider`** in `components/providers/app-client-shell.tsx`.

| Placement | Module | Why |
|-----------|--------|-----|
| Outer | `TunnelProvider` | Owns `channel-subscription-registry` + transport connection |
| Inside | `CreditBalanceProvider` | Calls `useCreditBalance()` → `useTunnelChannel('credit:balance')`; was previously outside `TunnelProvider`, causing a **second registry** when credit UI used standalone `useTunnel` |
| Inside | `GlobalTunnelListeners` | Single mount point for root side-effects; renders `AccountStatusTunnelListener` — add future global listeners here, not as siblings in `AppClientShell` |
| Inside | Route `children` | Feature hooks inherit the same registry |

**Locale SSOT (root shell):** `lib/pathname-without-locale.ts` → `localeFromPathname`. Root shell uses `next/navigation` (`usePathname`, `useRouter`), not `@/i18n/routing` — see `AccountStatusTunnelListener`, `GoogleOneTap`.

**Do not** mount `CreditBalanceProvider` or `GlobalTunnelListeners` above or beside `TunnelProvider`. **Do not** delete `account-status-tunnel-listener.tsx`; it is composed via `GlobalTunnelListeners`.

## Tunnel timing + duplicate fetch consolidation (2026-07-07)

**Boot-race is expected, not a bug:** `DeviceTelemetryProvider` posts to `/api/analytics/device` immediately on `status === 'authenticated'`, outside (above) `TunnelProvider` in `app-client-shell.tsx`. `TunnelProvider` Effect B waits a 400ms auth grace before connecting. The server-side `publishToUserTunnel` call therefore frequently logs `sse=false, ws=false` on first boot — this is HTTP-first-persistence-then-best-effort-fanout by design (see `2026-06-20-device-telemetry-ring-analytics.json`), not a broken WSS server.

Fixes landed this campaign:
- `lib/tunnel/publisher.ts` — the "queued" case (`!sseDelivered && !wsDelivered`) now logs at `console.debug`, not `console.log`, so it no longer reads as a failure.
- `lib/tunnel/native-ws/attach.ts` — telemetry + general inbox replay on WS `auth_ok`; `account:status` side effects replay on **subscribe** only (2026-07-08 profile reload loop fix).
- `lib/tunnel/hub/in-memory-hub.ts` — split offline queues: `userTelemetryQueues`, `userGeneralQueues`, `userSideEffectQueues`; cross-transport message-id dedupe.
- `lib/tunnel/tunnel-timing.ts` — `priorityRoutes` matching was an exact-string `.includes()`, so a bare `/admin` entry never matched `/admin/analytics`. Now prefix-matched (`matchesRoutePrefix`); `/admin` added to `priorityRoutes` so forensics/analytics admin sessions get earlier tunnel connect.

## Side-effect vs telemetry offline queues (2026-07-08)

| Queue kind | Channels | WS `auth_ok` drain | WS `subscribe` drain |
|------------|----------|--------------------|----------------------|
| Telemetry | `telemetry:*` | Yes (latest per channel) | — |
| General | credit balance, notifications inbox, … | Yes | — |
| Side effect | `account:status` | **No** | Yes (max 3, stale >60s dropped) |

`AccountStatusTunnelListener` coalesces `session.update({ accountStatusRefresh: true })` to one action per 2s window with message dedupe. It does **not** call `router.refresh()` on reactivate (that caused multi-GET `/profile` storms).

## Backlog (not yet implemented — tracked in docs widgets)

See `docs/en/features/tunnel-protocol.mdx` → **FutureFeatureBacklog** section:

1. **Redis / Connect hub mode** — horizontal scale (`TUNNEL_HUB_MODE=redis|connect`)
2. ~~**Postgres NOTIFY bridge**~~ — shipped (`TUNNEL_POSTGRES_FANOUT`); keep replicas=1 on k3s-or until headroom
3. ~~**Channel ACL (subscribe + publish)**~~ — `lib/tunnel/channel-acl.ts` on HTTP + WSS
4. **Subscribe telemetry** — ops metrics for duplicate subscribe detection
5. **useSync → useTunnelChannel** — optional full migration (currently uses `subscribeRef` pattern)
6. **Deprecated publisher alias** — `publish()` → `publishToUserTunnel()` in `lib/tunnel/publisher.ts`
7. ~~**StoreProvider route-gating** — limit store context to `/store` routes~~ — **done 2026-07-07**, but as deferred-fetch (provider stays global for the cart badge; `features/store/context.tsx` now defers the `GET /api/store/products` network call until the route matches `/store` or the cart already has items), not full unmount-gating.
8. **AppClientShell provider-tier flattening** — composable shells without breaking registry SSOT
9. **Root-shell locale lint guard** — block `@/i18n/routing` in `AppClientShell` subtree
