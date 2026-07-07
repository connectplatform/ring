# Ring App — Custom Hooks Reference

SSOT for root-level hooks in `ring-platform.org/hooks/`. Prefer **provider context** when a hook opens tunnel connections, polls APIs, or registers push tokens — see [Provider matrix](#provider-matrix) and [Remediation TODOs](#remediation-todos).

## Table of Contents

1. [useAuth](#useauth)
2. [useFCM](#usefcm)
3. [Realtime & notifications](#realtime--notifications)
4. [Wallet & credits](#wallet--credits)
5. [Utility hooks](#utility-hooks)
6. [Provider matrix](#provider-matrix)
7. [Remediation TODOs](#remediation-todos)

---

## useAuth

**File:** `hooks/use-auth.ts`  
**Provider:** `SessionProvider` (next-auth) in `app-client-shell.tsx`

Session state, role checks, auth navigation helpers, and **canonical sign-out** (FCM unregister + session cache clear + Auth.js `signOut`).

```typescript
import { useAuth } from '@/hooks/use-auth'

function ProfileMenu() {
  const { user, loading, hasRole, signOut, isAuthenticated } = useAuth()

  if (loading) return null

  return (
    <button type="button" onClick={() => signOut({ redirectTo: '/login' })}>
      Sign out
    </button>
  )
}
```

| Export | Purpose |
|--------|---------|
| `user` | Mapped `AuthUser` from Auth.js session |
| `role` | Resolved `UserRole` |
| `hasRole(required)` | Role ladder check |
| `signOut(options?)` | Unregisters FCM for this device, clears session cache, then Auth.js sign-out |
| `navigateToAuthStatus` | Type-safe redirects to unified auth status pages |
| `refreshSession` | Calls `useSession().update()` |

**Do not** import `signOut` from `next-auth/react` in UI chrome — use `useAuth().signOut()` so push tokens are invalidated.

---

## useFCM

**File:** `hooks/use-fcm.ts`  
**Provider:** `FCMProvider` in `app-client-shell.tsx` (wraps `useFCM` internally)

Browser push: permission, token lifecycle, foreground `onMessage`, and registration via **`upsertFcmToken` Server Action** (not raw `fetch` to the API from React).

```typescript
import { useFCM } from '@/hooks/use-fcm'

function NotificationSettings() {
  const { permission, token, requestPermission, isSupported, error } = useFCM()
  // ...
}
```

| Concern | SSOT |
|---------|------|
| Device fingerprint | `lib/notifications/device-fingerprint.ts` → `getOrCreateDeviceFingerprint()` |
| Token upsert | `app/_actions/fcm.ts` → `upsertFcmToken` |
| Logout cleanup | `useAuth().signOut()` → `unregisterCurrentDeviceFcmToken()` |
| Service worker | `public/firebase-messaging-sw.js` (Firebase 12.x compat) |

---

## Realtime & notifications

| Hook | File | Provider / owner | Notes |
|------|------|------------------|-------|
| `useTunnel` | `use-tunnel.ts` | `TunnelProvider` | Uses context when inside provider; else standalone manager |
| `useSync` | `use-sync.ts` | via tunnel | Channel subscription helper |
| `useUnreadCount` | `use-unread-count.ts` | **`NotificationProvider`** | Poll + tunnel `notifications:unread` |
| `useNotifications` | `use-notifications.ts` | list + `notifications:inbox` tunnel | `unreadCount` from `useNotificationContext()` |
| `useTunnelChannel` | `use-tunnel-channel.ts` | via `TunnelProvider` | SSOT channel subscribe |
| `useTunnelConnectionStatus` | `use-tunnel-connection-status.ts` | via `TunnelProvider` | Nav dot / latency; wraps `useRealtimeConnection()` |
| `useRealtimeData` | `use-realtime-data.ts` | via `TunnelProvider` | Bidirectional telemetry (`telemetry:{domain}`) |
| `useRealtime` | `use-realtime.ts` | per feature | Opportunity/entity streams + `useRealtimeNotifications` |
| `useMessaging` | `use-messaging.ts` | per conversation | Chat channel subscribe |

**Rule:** Nav badges and layout chrome must use `useNotificationContext()` from `notification-provider.tsx`, not direct `useUnreadCount()`.

---

## Wallet & credits

| Hook | File | Provider / owner |
|------|------|------------------|
| `useCreditBalance` | `use-credit-balance.ts` | **`CreditBalanceProvider`** — use `useCreditBalanceContext()` in UI |
| `useCreditHistory` | `use-credit-history.ts` | **`CreditHistoryProvider`** (wallet shell) — use `useCreditHistoryContext()` in UI |
| `useWalletBalance` | `use-wallet-balance.ts` | Web3Provider tree |
| `useTokenBalance` | `use-token-balance.ts` | on-chain reads |
| `useWalletActions` | `use-wallet-actions.ts` | wallet mutations |

---

## Utility hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDebounce` | `use-debounce.ts` | Debounced value for search inputs |
| `useLocalStorage` | `use-local-storage.ts` | JSON-aware localStorage state |
| `useMediaQuery` | `use-media-query.ts` | Responsive breakpoints |
| `useToast` | `use-toast.ts` | Shadcn toast helper |
| `useSessionCache` | `use-session-cache.ts` | Client session cache (cleared on sign-out) |
| `useVendorStatus` | `use-vendor-status.ts` | `/api/vendor/status` single-flight + 30s TTL cache; one-shot read, no provider needed |

> **Note:** i18n uses `next-intl` (`useTranslations`) — there is no `useLanguage` hook in this tree.

---

## Provider matrix

```
app-client-shell.tsx
├── SessionProvider
├── CreditBalanceProvider    → useCreditBalanceContext()
├── FCMProvider              → useFCM() (internal)
├── TunnelProvider           → useTunnel() with shared connection
├── Web3Provider
└── StoreProvider

WalletWrapper (wallet routes)
├── CreditHistoryProvider    → useCreditHistoryContext()  [scoped, not app-global]
├── I18nProvider
└── NotificationProvider   → useNotificationContext()
```

Hooks that **open network subscriptions** should have exactly one owner provider per session. Feature pages may subscribe to scoped channels (e.g. one conversation) but must not duplicate global badge/balance streams.

---

## Remediation TODOs

Tracked in `AI-CONTEXT/ring-platform.org/concepts/hooks-provider-subscription-matrix.json`.

### P0 — correctness

- [x] **`features/wallet/components/send-tokens.tsx`** — use `useCreditBalanceContext()`; removed invalid `await useCreditBalance()`; refresh via context after send.

### P1 — duplicate subscriptions

- [x] **Unread count** — nav widgets + notification-badge + notification-center now use `useNotificationContext()`:
  - `components/navigation/sidebar-identity-panel.tsx`
  - `components/navigation/mobile-user-widget.tsx`
  - `components/navigation/sidebar-synced-layout.tsx`
  - `components/navigation/user-widget.tsx`
  - `components/ui/notification-badge.tsx`
  - `features/notifications/components/notification-center.tsx`
- [x] **Credit balance** — wallet/opportunity surfaces use `useCreditBalanceContext()`:
  - `app/[locale]/(protected)/wallet/wallet-client.tsx`
  - `features/wallet/components/wallet-section.tsx`
  - `features/opportunities/components/opportunity-details.tsx`
  - `features/opportunities/components/opportunity-list.tsx`
  - `features/wallet/components/send-tokens.tsx`

### P2 — architecture

- [x] `useTunnelChannel` SSOT hook — `hooks/use-tunnel-channel.ts` (TunnelProvider path A).
- [x] `useCreditBalance` migrated off `useTunnelSubscription`.
- [x] Server publishes `notifications:inbox` on notification create.
- [x] `useNotifications` + `useRealtimeNotifications` use tunnel inbox + context unread SSOT.
- [x] `scripts/validate-provider-ssot.sh` recreated (was deleted in an unrelated
      working-tree cleanup) and wired into CI is still open below; run manually
      via `./scripts/validate-provider-ssot.sh` until then.
- [ ] Wire `scripts/validate-provider-ssot.sh` into CI.
- [ ] Remove deprecated `use-tunnel-subscription.ts` after soak period.
- [ ] Distributed TunnelHub (Redis) for multi-pod — see `2026-06-20-tunnel-channel-consolidation-p2.json`.

### P4 — duplicate-fetch consolidation (2026-07-07, `ring_ssot_logic_upgrade`)

- [x] **Vendor status** — `hooks/use-vendor-status.ts` single-flight + 30s TTL cache;
      replaces duplicate inline `fetch('/api/vendor/status')` in
      `sidebar-synced-layout.tsx` and `sidebar-aside.tsx`.
- [x] **SessionProvider** — merged tuned refetch settings into the one active
      `features/auth/components/session-provider.tsx`; deleted two unused
      duplicates (`components/providers/session-provider.tsx`, `auth-provider.tsx`).
- [x] **Web Vitals** — `web-vitals-provider.tsx` now buffers `useReportWebVitals`
      callbacks into one batched POST (debounced) instead of one POST per metric.
- [x] **Credit balance bootstrap** — module-scope single-flight + 5s TTL in
      `hooks/use-credit-balance.ts`, impervious to Strict Mode / Suspense-boundary
      ref resets that previously caused 2-3x duplicate `GET` on mount.
- [x] **Store products** — `features/store/context.tsx` defers the catalog fetch
      to store routes / non-empty cart only; `features/store/config.ts` adds
      `getCachedProductCatalog()` (`'use cache'` + `cacheTag('store:products')`)
      as the shared SSOT for both `app/api/store/products/route.ts` and the
      `getStoreProducts` server action, which previously called
      `adapter.listProducts()` independently.
- [x] **Tunnel timing/logging** — `/admin` added to `priorityRoutes` with
      prefix-matching (was exact-match, so `/admin` never matched
      `/admin/analytics`); publisher "queued" case logs at debug, not info;
      native WS `auth_ok` now drains the offline queue like the SSE route does.

### P3 — docs (in progress)

- [x] `docs/en/features/news.mdx` — Callout/Cards widgets; fix Mermaid
- [x] `docs/en/features/index.mdx` — replace broken mindmap
- [x] `docs/en/features/push-notifications-fcm.mdx` — `useFCM` SSOT
- [x] `docs/en/architecture/real-time.mdx` — provider callouts
- [x] `docs/en/development/code-structure.mdx` — hooks section
- [x] `docs/en/api/notifications.mdx` — FCM register contract

---

## Related docs

- [Push notifications (FCM)](/docs/features/push-notifications-fcm)
- [Realtime architecture](/docs/architecture/real-time)
- [Tunnel protocol](/docs/features/tunnel-protocol)
- [Code structure](/docs/development/code-structure)
