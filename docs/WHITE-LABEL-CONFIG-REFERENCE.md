# White‑Label Config Reference

Path: `whitelabel/instance.config.json`
Schema: `whitelabel/instance.config.schema.json`

## Properties
- `name` (string): Instance display name
- `brand`:
  - `colors`:
    - `primary`, `background`, `foreground`, `accent` (hex/hsl CSS values)
  - `logoUrl`, `faviconUrl`, `ogImageUrl` (strings)
- `seo`:
  - `titleSuffix`, `defaultDescription`
- `navigation`:
  - `links`: array of `{ label, href }`
- `hero`:
  - `title`, `subtitle`, `ctaText`, `ctaHref`, `showOnHome`
- `features` (object of booleans): `entities`, `opportunities`, `messaging`, `admin`, ...

## Example
```json
{
  "name": "Ring Default",
  "brand": {
    "colors": {
      "primary": "#3b82f6",
      "background": "#0b0f1a",
      "foreground": "#e5e7eb",
      "accent": "#22c55e"
    },
    "logoUrl": "/images/logo.svg"
  },
  "features": { "entities": true, "opportunities": true, "messaging": true }
}
```

## Notes
- When `whitelabel/instance.config.json` is missing, defaults from `whitelabel/examples/default.json` are used.
- Colors are injected at runtime by `components/whitelabel/InstanceThemeStyle.server.tsx` and consumed by Tailwind theme tokens.
- Server feature gating helpers live in `whitelabel/features.ts`.
