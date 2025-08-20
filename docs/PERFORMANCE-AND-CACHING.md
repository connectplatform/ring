# Performance and Caching Guide

## Bundle analysis
- Run analyzer:
  ```sh
  ANALYZE=true npm run build:skip-types
  ```
- Open reports:
  - `.next/analyze/client.html`
  - `.next/analyze/nodejs.html`
  - `.next/analyze/edge.html`

## Client bundle reduction
- Prefer dynamic import for feature-only deps (ethers, Web3):
  ```ts
  const { ethers } = await import('ethers')
  ```
- Lazy load heavy UI blocks (admin-only, charts, framer-motion-heavy) via `next/dynamic` with `ssr: false` when client-only.
- Avoid global polyfills. We limited fallbacks in `next.config.mjs` to the essentials required by Web3 libraries.

## Caching and revalidation
- Role-aware cached accessors:
  - `getCachedEntitiesForRole(roleKey)`
  - `getCachedOpportunitiesForRole(roleKey)`
- Tag invalidation on writes:
  - Entities: `invalidateEntitiesCache(['public','subscriber','member','confidential','admin'])`
  - Opportunities: `invalidateOpportunitiesCache(['public','subscriber','member','confidential','admin'])`

## WebSocket auth
- Sockets require a valid JWT. Use `Authorization: Bearer <jwt>` or `auth.token` in the handshake.

## Rate limits
- Lightweight IP+user limiter in `lib/rate-limit.ts`. Apply to write routes.
