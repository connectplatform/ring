# Ring AI Assistant Onboarding

### Your First 15 Minutes
- **Read**:
  - `ring/docs/PLATFORM-PHILOSOPHY.md`
  - `ring/docs/SYSTEM-ARCHITECTURE.md`
  - `ring/docs/AI-AGENT-PROMPT-TEMPLATE.md`
  - Any feature docs under `ring/docs/domains/**`
- **Discover context**: Prefer `context-artifacts/context.index.json` for lookup, then open `ring/AI-CONTEXT/AI-CONTEXT-INDEX.json` and related `AI-CONTEXT-*.json`.

### Run/Observe
- **Dev**:
  ```sh
  npm run dev
  ```
- **Next.js only**:
  ```sh
  npm run dev:nextjs
  ```
- **Build**:
  ```sh
  npm run build
  ```
- **Tests**:
  ```sh
  npm run test
  ```

### Core Abstractions (Use These)
- **Auth.js v5 (`auth()`)**: Server auth; adapter via Firebase Admin.
- **Firestore Admin (`getAdminDb`)**: Server-side data ops; avoid client SDK in server modules.
- **Service Layer**: Business logic under `ring/services/**`.
- **App Router API**: Routes in `ring/app/api/**`.

### Patterns and Constraints
- **React 19**: Server-first; use Server Components where possible, `useOptimistic` for UX.
- **i18n**: next-intl routing with locale-prefixed paths; middleware enforces `/{locale}/...`.
- **Access tiers**: Visitor → Subscriber → Member → Confidential → Admin → SuperAdmin.
- **Security**: Validate role/tier in services and API routes.
  - SuperAdmin is exposed on `session.user.isSuperAdmin` and can access `/[locale]/admin/settings`.

### Health Checks
- **HTTP**: `GET /api/info` returns `{ ip, city }`.
- **Auth**: `/api/auth/signin` page loads; JWT session created.
- **WebSocket**: Dev console logs `📡 WebSocket server ready`. Clients must pass `Authorization: Bearer <jwt>` or `auth.token` to connect.
- **Analyzer**: Use `ANALYZE=true npm run build:skip-types`, open `.next/analyze/client.html`.
- **Theming**: Changing `whitelabel/instance.config.json` colors reflects immediately via runtime CSS variables.

### Common Errors and Fixes
- **Missing AUTH/NEXT_PUBLIC env**: Copy `env.local.template` to `.env.local` and populate values.
- **Firebase Admin on client**: Only use `getAdminDb()` in server files.
- **Permission denied**: Ensure authenticated context and correct security rules; consider using server actions/API.
- **Socket auth failed**: Ensure a valid JWT (Auth.js v5) is supplied in the WebSocket handshake.

### Workflow
- **Before edit**: Read `AI-CONTEXT-INDEX.json` and relevant docs.
- **During edit**: Keep edits focused; follow existing TypeScript/Next.js style.
- **After edit**: Build, run tests, and verify dev server + WebSocket logs are clean.

### Updating Context Files
- Keep `ring/AI-CONTEXT/AI-CONTEXT-INDEX.json` updated when changing behavior, env, or interfaces.
- Add `AI-CONTEXT/<area>/AI-CONTEXT-*.json` under the unified `AI-CONTEXT/` directory for new contracts.
- Rebuild artifacts after updates:
  ```sh
  node scripts/context-build.mjs
  ```

### Configuration Quick Reference
- Key env vars (see `env.local.template`):
  - `AUTH_SECRET`, `NEXTAUTH_URL`
  - `AUTH_FIREBASE_*`, `FIREBASE_DATABASE_URL`
  - `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_API_URL`
  - `AUTH_GOOGLE_ID/SECRET`, `AUTH_APPLE_ID/SECRET`
  - `BLOB_READ_WRITE_TOKEN`, `POLYGON_RPC_URL`
  - Analyzer reports: `.next/analyze/{client,nodejs,edge}.html`

### Smoke Tests
```sh
# Info endpoint
curl -s http://localhost:3000/api/info | jq

# Auth (manual):
# Visit http://localhost:3000/api/auth/signin and sign in
```

### Contacts
- Default owner: `Sonoratek LLC`. Maintainers: `ring-dev@sonoratek.com`.


