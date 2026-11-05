# App client shell

Reference for agents changing `app-client-shell.tsx`. The file is the client provider tree for every Ring page. Locale chrome (navigation, translations, notification badges, curtain) is a child of this tree, not a sibling.

Source: `ring/web/components/providers/app-client-shell.tsx`  
Mounted from: `ring/web/app/layout.tsx` (`AuthenticatedAppShell` inside `<Suspense>`)  
Hook index: `ring/web/hooks/HOOKS-README.md`  
Matrix (partial, see staleness note): `AI-CONTEXT/ring-platform.org/concepts/hooks-provider-subscription-matrix.json`

## Mount

`RootLayout` renders:

```tsx
<Suspense fallback={<AppShellStaticFallback />}>
  <AuthenticatedAppShell instanceConfig={instanceConfig}>
    {children}
  </AuthenticatedAppShell>
</Suspense>
```

`AuthenticatedAppShell` awaits `auth()` and seeds FX rates, then renders `AppClientShell`. `auth()` calls `connection()`. It stays inside Suspense so Next.js 16 does not treat the root layout as a blocking route.

Props `AppClientShell` accepts:

| Prop | Source | Role |
|---|---|---|
| `instanceConfig` | server `PublicInstanceConfig` | Whitelabel snapshot for `useInstanceConfig()` |
| `session` | `auth()` | SSR session. Stops the `loading` → `unauthenticated` flash on protected forms |
| `initialExchangeRates` | `ensureFxFeedFresh()` + `getExchangeRates()` from `@/lib/ring-oracle` | First paint of catalog prices. `null` if the oracle throws; client then uses ring-config rates |
| `children` | root layout children | The locale segment, including `LocaleAppChrome` |

`AppShellStaticFallback` is the Suspense fallback only. It renders `ThemeProvider` and `InstanceConfigClientProvider` around a pulse placeholder. It must not render route `children`. A fallback that also renders `children` hydrates the App Router slot twice and freezes the desktop rail.

## Tree (outside → inside)

```
SessionProvider
  WebVitalsProvider
    DeviceTelemetryProvider
      ThemeProvider
        InstanceConfigClientProvider
          AppProvider
            MediaUseTargetProvider
              FCMProvider
                TunnelProvider          autoConnect={false} debug={false}
                  CallSessionProvider
                    CreditBalanceProvider
                      Web3ScopeProvider
                        StorePaymentMethodsProvider
                          StoreProvider
                            {children}
                            GoogleOneTap          omitted when isLoginPath
                            RingAnalyticsBeacon
                            AppShellServiceWorker
                    FCMPermissionPrompt           omitted when isLoginPath
                    Toaster
```

`void StoreScreen` is not in the tree. It is a live import so Turbopack evaluates the store screen with this module. See the StoreScreen section.

## Rules that have already broken this file

1. **One children slot.** `TunnelProvider`, `FCMProvider`, `CreditBalanceProvider`, and `Web3ScopeProvider` each render `children` once. Do not also pass `children` as a Suspense fallback. Next.js 16 hydrates that slot once; a duplicate leaves SSR chrome frozen (icon rail, dead theme, language, add, and login).

2. **Do not swap to a lean provider tree on `/login`.** `usePathname()` becomes `/login` before the locale RSC replaces the full chrome. Navigation, `CurtainHost`, and `GlobalIncomingCallBanner` are still mounted and call `useCallSession` and `useCreditBalanceContext`. Dropping `CallSessionProvider` (or credit, or tunnel) throws, and `app/error.tsx` shows “Oops! Something went wrong” on `login?from=/profile`, `from=/settings`, and `from=/consultant`. Keep this one tree. The login screen only skips `GoogleOneTap` and `FCMPermissionPrompt`.

3. **`isLoginPath` is exact.** `lib/pathname-without-locale.ts` returns true only when the locale-stripped path is `/login`. `/login/onboarding` is not the login screen. Prompts still mount there.

4. **One owner per subscription.** Credit balance, unread notifications, and `useFCM()` each have a single runtime. Consumers use the context hook. A second `useTunnel()` or `useFCM()` in a leaf reopens the loops fixed in 2026-06 and 2026-07.

5. **Global tunnel listeners do not mount here.** `AccountStatusTunnelListener`, `GlobalIncomingCallBanner`, and `GlobalIncomingGameBanner` belong in `components/providers/global-tunnel-listeners.tsx`, which `locale-app-chrome.tsx` mounts under this `TunnelProvider`.

## What the matrix still says

`hooks-provider-subscription-matrix.json` (updated 2026-06-20) lists the global layer as `SessionProvider`, `CreditBalanceProvider`, `FCMProvider`, `TunnelProvider`, `Web3Provider`, `StoreProvider`, and the locale layer as `I18nProvider`, `NotificationProvider`.

The live shell also has `WebVitalsProvider`, `DeviceTelemetryProvider`, `ThemeProvider`, `InstanceConfigClientProvider`, `AppProvider`, `MediaUseTargetProvider`, `CallSessionProvider`, `Web3ScopeProvider` (not a root `Web3Provider`), and `StorePaymentMethodsProvider`. `I18nProvider` and `NotificationProvider` stay in `locale-app-chrome.tsx`. Validation script named by the matrix: `ring-platform.org/scripts/validate-provider-ssot.sh` (historical path; confirm before running).

Related record: `AI-CONTEXT/concepts/2026-07-07-ssot-duplicate-fetch-tunnel-timing.json` (SessionProvider refetch, web-vitals batching, credit bootstrap single-flight).

---

## SessionProvider

File: `features/auth/components/session-provider.tsx`  
Hook: `useSession()` from `next-auth/react`. App code often goes through `useAuth()` (`hooks/use-auth.ts`), which also unregisters push on sign-out.

Options passed today:

| Option | Value | Why |
|---|---|---|
| `session` | SSR session from `auth()` | First client render matches the server |
| `refetchInterval` | `15 * 60` (seconds) | One background poll |
| `refetchOnWindowFocus` | `false` | Stops a `GET /api/auth/session` on every focus |
| `refetchWhenOffline` | `false` | No poll while offline |

Do not wrap a second `SessionProvider` inside a page. The 2026-07-07 record says the shell copy is the only active implementation.

Records:

- `AI-CONTEXT/ring-platform.org/concepts/hooks-provider-subscription-matrix.json`
- `AI-CONTEXT/concepts/2026-07-07-ssot-duplicate-fetch-tunnel-timing.json`
- `AI-CONTEXT/ring-platform.org/features/auth.json` — Auth.js v5 providers (Google GIS + OAuth, Apple, magic link, crypto wallet, PIN), roles, backends
- `AI-CONTEXT/ring-platform.org/features/auth-details.json` — Auth.js v5, PostgreSQL adapter, GIS
- `AI-CONTEXT/ring-zemna-ai/implementations/authjs-v5-optimization-creditbalance-provider-2026-02-12.json` — session refetch paired with the credit provider

`useSession` must stay available on `/login`. `LoginAuthenticatedRedirect` uses it to bounce a real session without trusting the proxy cookie.

## WebVitalsProvider

File: `components/providers/web-vitals-provider.tsx`  
Props: `children` only.

`useReportWebVitals` fires once per metric (CLS, FCP, LCP, TTFB, INP). The provider buffers them and POSTs one body to `/api/analytics/web-vitals` after `FLUSH_DEBOUNCE_MS` (1500). The body matches `webVitalsPayloadSchema` (`features/analytics/lib/analytics-db.ts`): `sessionId`, `url`, `userAgent`, `metrics`, `timestamp`, `userId`. `keepalive: true`. It needs `SessionProvider` above it so `userId` is the signed-in id when present.

Records:

- `AI-CONTEXT/implementations/2026-06-29-news-web-vitals-integration.json` — this provider already wraps every page; news admin reads the same stream filtered to `/news/`
- `AI-CONTEXT/concepts/2026-07-07-ssot-duplicate-fetch-tunnel-timing.json` — the batch exists so a page load is not five POSTs

Do not add a second `useReportWebVitals` reporter in a page.

## DeviceTelemetryProvider

File: `components/providers/device-telemetry-provider.tsx`

| Option | Shell value | Meaning |
|---|---|---|
| `children` | the rest of the tree | required |
| `enableGeo` | omitted, so `false` | `true` asks the browser for coarse geolocation once per session |

Posts coalesced snapshots to `/api/analytics/device` for an authenticated user only. Minimum gap `MIN_POST_INTERVAL_MS` is 30s. Resize debounce is 500ms. Does not open a tunnel socket. Needs `SessionProvider`.

Record: `AI-CONTEXT/ring-platform.org/implementations/2026-06-20-device-telemetry-ring-analytics.json` — `user_device_telemetry`, migration 023, this collector.

Turning `enableGeo` on is a product decision: it shows a browser permission prompt on every session until the user answers.

## ThemeProvider

File: `components/providers/theme-provider.tsx`  
Wraps `next-themes`. Fixed options: `attribute="class"`, `enableSystem`, `enableColorScheme`, `disableTransitionOnChange={false}`. Any extra `NextThemesProvider` prop passed through `{...props}` overrides those.

The shell passes `defaultTheme={themeDefaultFromInstance(instanceConfig.theme?.default)}`. The fallback passes the same helper over `APP_SHELL_STATIC_INSTANCE_CONFIG`. The helper is a pure function: `light`, `dark`, and `system` pass through; `auto` and anything else become `system`. It does not call `use()` and it does not read context. `ThemeProvider` stays outside `InstanceConfigClientProvider` because the config object is already a prop.

`next-themes` applies `defaultTheme` only when the browser has no stored theme. A later visit keeps the user's choice.

Record: `AI-CONTEXT/ring-platform.org/analysis/theme-system-analysis.json`. Brand colors travel on `PublicInstanceConfig.brand` through `InstanceThemeStyle`, not through `next-themes`.

`GoogleOneTap` calls `useTheme()`, so it has to stay under this provider. The shell already does that.

## InstanceConfigClientProvider

File: `components/common/whitelabel/instance-config-client.tsx`  
Hook: `useInstanceConfig()` in `hooks/use-instance-config.ts` (React 19 `use()`). Throws if the context is null.

| Option | Shell value |
|---|---|
| `value` | `instanceConfig` from the server layout. The fallback uses `getPublicInstanceConfigFromSnapshot()` |
| `children` | the rest of the client tree |

`PublicInstanceConfig` (`lib/ring-config-types.ts`) is the client-safe subset: `name`, `brand.colors` (`primary`, `background`, `foreground`, `accent`), optional `logoUrl` / `faviconUrl` / `ogImageUrl`, optional `theme`, `seo`, `navigation`, `hero`, and `features: Record<string, boolean>`. Secrets stay on the server.

`components/providers/instance-config-provider.tsx` is a **server** wrapper that calls `getPublicInstanceConfig()` and renders this same client provider. Use it only for a nested layout that is not already under `AppClientShell`. A second provider inside the shell masks the layout value.

No concept file is named for this provider. Adjacent records:

- `AI-CONTEXT/concepts/layered-ring-l1-l2-l3-preset-split.json` — L3 `ring-config.json` is the clone file; compose copies it over L1
- `AI-CONTEXT/ring-vikka-ua/concepts/whitelabel-navigation-architecture-2025-12-17.json` — config-based nav variants
- `AI-CONTEXT/ring-ring-ck-ua/implementations/2026-06-04-root-layout-shell-migration.json` — shell + `Web3ScopeProvider` landed with the root layout

## AppProvider

File: `contexts/app-context.tsx`  
Props: `children` only.

Holds client state for `entities`, `opportunities`, and `error`. It is not the whitelabel config and not the session.

Page views belong to `RingAnalyticsBeacon` only (`/scripts/analytics.js` → `POST /api/analytics/app`). Decided 2026-11-05:

- Do not load `/scripts/app-analytics.js`. It posted the same store (`app_load`, `feature_usage`, form, `page_hidden`) and double-counted loads. Those events stay off.
- Do not load `/scripts/error-tracking.js`. Next.js shows `app/error.tsx` and logs to the console. `instrumentation.ts` has no `onRequestError`. `POST /api/analytics/errors` stays in the tree with no client writer. `AppErrorBoundary` is not mounted on this shell, and `/api/errors/report` does not exist.
- Do not `preconnect` Firestore or Identity Toolkit here. Firebase warmup stays in `lib/preload/setup.ts` `setupResourcePreloading()`, called from `app/[locale]/layout.tsx` on every route except `/login`, and only preconnects Firebase Storage when `NEXT_PUBLIC_FIREBASE_API_KEY` is set.

No AI-CONTEXT record. Do not store tunnel or credit state here; those already have owners.

## MediaUseTargetProvider

File: `features/generative-media/media-use-target.tsx`  
Props: `children` only.

Context value: `activeTarget`, `register(target)`, `unregister(id)`. A focused TipTap or field surface registers `{ id, replace }`. Payload is `{ kind: 'image' | 'video', url, fileId?, alt?, webpUrl? }`.

Use order in the gallery modal: `onUseImage ?? activeTarget.replace`. `GenerativeMediaField` keeps its own `onUseImage` and does not depend on this context.

Record: `AI-CONTEXT/concepts/generative-media-gallery-ssot.json`.

The provider is above the route tree so a modal opened from any page can see the focused field. Unmounting it on one route clears the registered target.

## FCMProvider and FCMPermissionPrompt

File: `components/providers/fcm-provider.tsx`  
Hook: `useFCMContext()`. Throws outside the provider. Implementation uses React 19 `use()`.

`FCMProvider` props: `children` only. `FCMProviderRuntime` is the only caller of `useFCM()`. `useFCMMessages(onMessageReceived, fcmForeground)` must not call `useFCM` again.

Context fields: `isEnabled`, `isSupported`, `isLoading`, `error`, `needsHomeScreenInstall`, `enableNotifications()`, `disableNotifications()`, `tokenCount`.

Foreground behavior: `call_invite` and `game_request` return without a toast (the call and game banners own them). `chat` navigates to `/chat/${chatId}`.

`FCMPermissionPrompt` has no props. It reads context. Session keys: `fcm-prompt-dismissed`, `fcm-install-prompt-dismissed`. It does not show when:

- `isLoginPath(pathname)` (also enforced by the shell returning `null`)
- the matching sessionStorage flag is set
- permission is already `granted` and this is not the iOS install prompt
- `isTelegramMiniAppShell()` (Telegram already delivers Mini App notifications)
- iOS needs a home-screen install and the browser is not iOS Safari

`AppShellServiceWorker` registers the worker and does not ask for permission. The prompt is the only permission UI.

Records:

- `AI-CONTEXT/concepts/hooks-use-fcm-web-push-client-hook.json` — `subscribeWithVapid()` is the only `getToken` path; persist is `POST /api/notifications/fcm/register`; RFC web-push is a second device class (Safari / no FCM subscription), not a second Chrome pipe
- `AI-CONTEXT/ring-platform.org/concepts/hooks-use-fcm-push.json` — service worker scope `/`, `updateViaCache: 'none'`
- Truth lens when changing the hook: `AI-LEGIOX/legiox-truth-lens/hooks-use-fcm.nodus.json`

Do not construct `Notification` inside `useFCMMessages` while the tab is focused. Focused call and game traffic uses the banners.

## TunnelProvider

File: `components/providers/tunnel-provider.tsx`  
Hook: `useTunnelContext()` (throws). Leaf code should prefer `useTunnel()` only where the subscription matrix allows it. Credit and unread counts do not.

| Option | Shell value | Default in the component |
|---|---|---|
| `config` | omitted | `Partial<TunnelConfig>` merged by the runtime |
| `autoConnect` | `false` | `true` |
| `debug` | `false` | `false` |
| `timingStrategy` | omitted | `TunnelTimingStrategy.PROGRESSIVE` |

`autoConnect={false}` skips hook-level connect. The provider still runs `tunnelTimingManager` after auth and pathname resolve. That is the k8s setting: do not flip the shell back to `autoConnect={true}` to “make realtime start.”

`useSession` and `usePathname` run inside the runtime, so this provider stays under `SessionProvider`.

Consumers that throw without it: `useCreditBalanceContext` (the credit hook’s tunnel lives here), `useTunnelContext`, and anything in `GlobalTunnelListeners`.

Records:

- `AI-CONTEXT/ring-platform.org/implementations/2026-06-20-tunnel-realtime-migration.json` — `useTunnelConnectionStatus` wraps provider connection state; `credit:balance` uses `userScoped: false` on the channel that the provider owns
- `AI-CONTEXT/ring-platform.org/implementations/2026-06-20-tunnel-channel-consolidation-p2.json` — path A is `TunnelProvider` / `useTunnelChannel`; path B (`useTunnelSubscription`) was the duplicate
- `AI-CONTEXT/ring-platform.org/core/patterns.json` — one `TunnelProvider` for subscription management; transport choice stays in `createTunnelConfig()`

`CreditBalanceProvider`’s own comment: it must mount inside this provider. The shell order already does that.

## CallSessionProvider

File: `features/chat/providers/call-session-provider.tsx`  
Props: `children` only.

Holds the active call across soft navigation so `useWebRtcCall` keeps one `RTCPeerConnection` instead of hanging up on every route change.

| Export | Use |
|---|---|
| `useCallSession()` | Throws outside the provider. `CurtainHost` and `GlobalIncomingCallBanner` use this |
| `useCallSessionOptional()` | Returns null outside. `use-webrtc-call.ts` uses this |

Snapshot fields: `conversationId`, `peerUserId`, `callId`, `media`, `phase`, `keepAliveAcrossNav`. Also `pendingInvite` / `setPendingInvite` and `bindActiveCall`.

Records:

- `AI-CONTEXT/concepts/messenger-call-ui-backlog-victory-2026-07-10.json` — `POST /api/conversations/[id]/call-invite` publishes `calls:incoming`; `IncomingCallBanner` shows it
- `AI-CONTEXT/concepts/curtain-offer-engine.json` — curtain skips while a realtime call is busy; `CurtainHost` reads `useCallSession()`

This provider is why the login soft-nav must not unmount the tree. The banner and the curtain outlive the pathname change by one RSC round-trip.

## CreditBalanceProvider

File: `components/providers/credit-balance-provider.tsx`  
Props: `children` only. The runtime calls `useCreditBalance()` once.

| Hook | Behavior |
|---|---|
| `useCreditBalanceContext()` | Throws outside. Navigation, wallet, and opportunity UI use this |
| `useOptionalCreditBalance()` | Null outside |

Context: `balance`, `subscription`, `limits`, `isLoading`, `isRefreshing`, `error`, `refresh()`, `lastRefreshed`, `isTunnelConnected`.

Must sit inside `TunnelProvider`. A fallback that also renders `children` deadlocks hydration (same rule as tunnel).

Records:

- matrix facts: one credit subscription per session; wallet and opportunity consumers use `useCreditBalanceContext()`
- `AI-CONTEXT/ring-zemna-ai/implementations/authjs-v5-optimization-creditbalance-provider-2026-02-12.json`
- `AI-CONTEXT/concepts/2026-07-07-ssot-duplicate-fetch-tunnel-timing.json` — module-scope single-flight and 5s TTL in `hooks/use-credit-balance.ts`
- `AI-CONTEXT/ring-platform.org/implementations/2026-06-20-tunnel-realtime-migration.json`

`features/wallet` top-up UI reads this balance. It is not the membership price and not `StorePaymentMethodsProvider`.

## Web3ScopeProvider

File: `components/providers/web3-scope-provider.tsx`  
Props: `children` only.

Mounts wagmi only when `pathNeedsWeb3` is true (`lib/pathname-without-locale.ts`):

- `/login` (wallet connect on the login screen)
- `/auth/wallet-connect`
- `/wallet`
- `/store/checkout`
- `/nft`
- `/ai-web3`
- `/admin/nft`
- `/admin/web3`

On other paths the provider renders `children` with no wagmi tree. The chunk loads in an effect (`import('@/providers/web3-provider')`) and hydrates with `cookieToInitialState(wagmiConfig, document.cookie)`.

Do not use `next/dynamic({ ssr: false })` here. Under `cacheComponents` that bails the whole route out to client rendering. `/login` is a web3 path, and that pattern painted a white screen with only the document title.

Uses `next/navigation` `usePathname`, not next-intl. The root shell is outside `NextIntlClientProvider`.

Records:

- `AI-CONTEXT/ring-ring-ck-ua/implementations/2026-06-04-phase2-public-layout-proxy-hreflang.json` — `WagmiInitialLoader`, cookie header, `Web3ScopeProvider` `initialState`; RainbowKit root provider removed
- `AI-CONTEXT/ring-ring-ck-ua/implementations/2026-06-04-root-layout-shell-migration.json`

The matrix name `Web3Provider` is the inner component (`@/providers/web3-provider`), not this scope gate.

## StorePaymentMethodsProvider

File: `features/store/currency-context.tsx`

| Option | Shell value |
|---|---|
| `initialExchangeRates` | Oracle map from `AuthenticatedAppShell`, or `null` |
| `children` | store provider and below |

Display SSOT for catalog prices. Base currency is `store.mainCurrency` (`getMainCurrencySymbol()`). The rail toggles `main_currency` ↔ `native_token`. Rates: the SSR seed first, then `getLiveExchangeRates` / `convertViaRates`, with ring-config `convertTo` / `convertFromMainCurrency` as fallback. Unknown currency codes fall back to the main currency.

Persistence when the user changes currency: `localStorage['ring-currency']` and cookie `ring-currency` (1 year, `SameSite=Lax`).

Hooks: `useStorePaymentMethods()` throws; `useOptionalStorePaymentMethods()` returns null.

This is not `PaymentConductor` and not a checkout rail (`card | paypal | credit_balance | native_token`). PaymentConductor stays on the checkout path.

Records:

- `AI-CONTEXT/ring-platform.org/timeline/currency-context-global-implementation-2025-11-01.json`
- `AI-CONTEXT/ring-platform.org/timeline/cart-currency-integration-2025-11-04.json`
- `AI-CONTEXT/concepts/store-currency-display-ssot-fix.json` — empty `credits.unit` made `convertPrice` target an empty code
- `AI-CONTEXT/concepts/ssot-currency-vocabulary.json` — server finance SSOT is `@/lib/ring-oracle`; this provider is the display client
- `AI-CONTEXT/concepts/store-currency-daar-legacy-coercion.json` — do not pass a currency the rate table does not contain (historical DAAR vs USD/UAH/RING)

## StoreProvider

File: `features/store/context.tsx`  
Props: `children` only.  
Hooks: `useStore()` throws; `useOptionalStore()` returns null. `CurtainHost` uses the optional hook so the curtain can read products without requiring a store page.

Holds cart, product lists, and ERP slices (`enhancedProducts`, recommendations). Cart writes go through `cartLineVendorId` / `priceCartLine` and emit `STORE_CART_UPDATED_EVENT`. It reads currency from `StorePaymentMethodsProvider`, so it stays inside that provider.

The matrix names this provider as the store slot of the global shell. Cart UI in the header (`MiniCart`, `FavoritesMenu`) calls `useStore` while the locale chrome is still mounted, including during the login soft-nav, so this provider stays in the single tree.

## Children

`children` is the root layout body: `[locale]` layouts, `LocaleAppChrome`, and the page. Those layouts add `I18nProvider` and `NotificationProvider`. They are not duplicated here. Message scope for `/login` is `auth` (`lib/i18n/message-scopes.ts`: `common`, `pages`, `modAuth`, `config`). A client under this shell that calls `useTranslations` for a namespace outside that scope throws once the login RSC arrives.

## GoogleOneTap

File: `features/auth/components/google-one-tap.tsx`  
Shell: wrapped in `<Suspense fallback={null}>` because it uses client hooks that can suspend, and **not rendered when `loginScreen`**.

| Option | Shell value |
|---|---|
| `redirectUrl` | omitted |

The component also treats `/login`, `/auth`, and `/admin` as auth surfaces and does not prompt there. The shell skip is the extra guard so the prompt never mounts on the exact login screen.

Flow: FedCM prompt → credential callback → Auth.js provider `google-one-tap` → about 100ms so the session cookie lands → redirect. The visible login button does not use this file. The button is `signIn('google')` (`google-signin-button-gis.tsx` on clones that overlay it).

Needs `ThemeProvider` (`useTheme` for FedCM color scheme) and `SessionProvider`. Uses `next/navigation`, not next-intl `useRouter`.

Records:

- `AI-CONTEXT/ring-platform.org/ring-platform-google-gis-analysis.json`
- `AI-CONTEXT/ring-platform.org/implementations/google-gis-auth-delayed-redirect-fix-2026-01-06.json` — the cookie delay
- `AI-CONTEXT/ring-greenfood-live/concepts/google-signin-button-gis-official-implementation.json` — the button, which is a different component

## RingAnalyticsBeacon

File: `components/providers/ring-analytics-beacon.tsx`  
No props. Shell wraps it in `<Suspense fallback={null}>` because `useSearchParams()` suspends.

Loads `/scripts/analytics.js` with `next/script` `strategy="afterInteractive"`. On every App Router navigation it calls `window.ringAnalytics.pageView(pathname + search)`. The script’s own listener only sees the first hard load.

Stays mounted on `/login`, so login views are counted. That is intentional; only the permission prompt and One Tap are suppressed.

Adjacent records (page-view pipeline, not this component’s name):

- `AI-CONTEXT/implementations/2026-06-29-news-stats-admin-validation.json`
- `AI-CONTEXT/ring-platform.org/implementations/2026-06-20-device-telemetry-ring-analytics.json` (device ingest, separate from `pageView`)

## AppShellServiceWorker

File: `components/providers/app-shell-service-worker.tsx`  
No props. Renders `null`.

On mount, skips every iOS device (`isIosDevice()`). Otherwise calls `registerAppShellServiceWorker()` (`lib/notifications/register-app-shell-sw`). It does not request notification permission.

iOS push still depends on `FCMPermissionPrompt` and a home-screen install (`needsIosHomeScreenForPush`). Truth lens for that constraint: `AI-LEGIOX/legiox-truth-lens/code-apple-pwa-ios-16-guru.nodus.json`.

## Toaster

File: `components/ui/toaster.tsx`  
No props. Reads `useToast()` and renders `ToastProvider` plus one `Toast` per item.

`TunnelProvider` and `FCMProvider` call `toast()` from `hooks/use-toast`. The toaster has to stay mounted on `/login` or those toasts never appear. There is no AI-CONTEXT record for this component.

## StoreScreen (import only)

File: `app/[locale]/store/store-screen.tsx`  
The shell imports it and discards the binding (`void StoreScreen`). The store route renders `<StoreScreen locale={locale} />`, which composes `StoreWrapper` and `StorePageClient`.

Record: `AI-CONTEXT/troubleshooting/runtime/turbopack-store-soft-nav-invalid-element.json`.

On Next.js 16 Turbopack the first client click to `/store` can render “Element type is invalid… got undefined” because the flight asks for `default` before the chunk list has installed it. Keeping this module in the shell graph evaluates `StoreWrapper` during the layout load. A hard refresh of `/store` already worked; the bug was the first soft navigation.

Do not remove the import as an unused-symbol cleanup. Do not patch `requireModule`. Do not put `next/dynamic({ ssr: false })` back on `store-wrapper.tsx`.

## Locale chrome that depends on this shell

These are not declared in `app-client-shell.tsx`. They mount later and still require the providers above.

| Piece | File | Needs |
|---|---|---|
| `I18nProvider` | `components/providers/i18n-provider.tsx` via `locale-app-chrome.tsx` | nothing from this shell except to be inside the client tree |
| `NotificationProvider` | notifications feature, locale chrome | sole `useUnreadCount` / `notifications:unread` subscription |
| `GlobalTunnelListeners` | `components/providers/global-tunnel-listeners.tsx` | `TunnelProvider`, `CallSessionProvider`, `SessionProvider` |
| `CurtainHost` | `features/curtain/components/curtain-host.tsx` | `useCallSession`, optional store, `useTranslations('modules.curtain')` |
| Navigation credit chip | `components/navigation/navigation.tsx` | `useCreditBalanceContext`, `useStore` |

Record for the curtain: `AI-CONTEXT/concepts/curtain-offer-engine.json`.

## When you change the tree

- Add a provider that owns a new subscription here, once, and export a context hook. Do not call the raw hook from a leaf and from the provider.
- Put tunnel listeners in `GlobalTunnelListeners`, not as new siblings in this file.
- If a hook throws “must be used within X” during a client navigation to `/login`, the previous chrome is still mounted. Keep `X` in this tree.
- After a real change to who owns credit, unread, FCM, or tunnel, update `hooks-provider-subscription-matrix.json` by merge (append the new fact). The file is behind this tree today.
