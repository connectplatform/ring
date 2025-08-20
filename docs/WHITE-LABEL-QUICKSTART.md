# White‑Label Quickstart

## 1) Configure your instance
- Copy example:
  ```sh
  cp whitelabel/examples/default.json whitelabel/instance.config.json
  ```
- Edit `whitelabel/instance.config.json`:
  - `name`, `brand.colors`, `brand.logoUrl`
  - `navigation.links`
  - `hero` (optional)
  - `features` (toggle modules)

## 2) Run locally
```sh
npm install
npm run dev
```

## 3) Brand assets
- Place images under `public/images/` and reference in config.
- Favicon under `public/favicon.ico`.

## 4) Theming
- Colors are injected at runtime via `components/whitelabel/InstanceThemeStyle.server.tsx`.
- Tailwind reads tokens from CSS variables; change `brand.colors` without rebuild.

## 5) Feature gating
- Features are controlled via config and evaluated server-side in `whitelabel/features.ts`.
- Disabled features hide pages and return 404s for write endpoints.

## 6) SuperAdmin Settings
- Page: `/[locale]/admin/settings` (SuperAdmin only) for branding, colors, features, categories.
- Seed demo SuperAdmin (email/password) for local dev:
  ```sh
  # requires Firebase Admin env vars configured
  ts-node scripts/seed-superadmin.ts
  # or
  SEED_SUPERADMIN_EMAIL=admin@myri.ng SEED_SUPERADMIN_PASSWORD=12345 ts-node scripts/seed-superadmin.ts
  ```

## 7) Deployment (Docker)
- Build:
  ```sh
  docker build -t ring:whitelabel .
  ```
- Run:
  ```sh
  docker run -p 3000:3000 -v "$PWD/whitelabel:/app/whitelabel" ring:whitelabel
  ```

## 8) Slots
- Toggle features in config
- Customize header/footer/hero via slots (defaults provided)

## 9) i18n
- Locale-prefixed routes (`/[locale]/...`) powered by next-intl
- Add locale files under `ring/locales/<locale>/`
  - Split files: `common.json`, `pages.json`, `emails.json`, `seo.json`, `config.json`, `modules/*.json`
- The next-intl provider is wired in `app/[locale]/layout.tsx` via `components/providers/i18n-provider.tsx`
