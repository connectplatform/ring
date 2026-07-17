# Calculator Module — Install Checklist

Modeled on `scripts/install-refcodes-module.sh`. Copy the generic calculator engine into a Ring clone and enable via `ring-config.json`.

## 1. Copy verbatim

```bash
CANON=/path/to/ring-platform.org
TARGET=/path/to/ring-clone

cp -R "$CANON/features/calculator" "$TARGET/features/calculator"
cp "$CANON/app/[locale]/calculator/page.tsx" "$TARGET/app/[locale]/calculator/page.tsx"
cp "$CANON/locales/en/calculator.json" "$TARGET/locales/en/calculator.json"
cp "$CANON/locales/uk/calculator.json" "$TARGET/locales/uk/calculator.json"
cp "$CANON/locales/ru/calculator.json" "$TARGET/locales/ru/calculator.json"
```

## 2. ring-config.json (top-level SSOT)

```json
"calculator": {
  "enabled": true,
  "presetId": "project"
}
```

Set `"enabled": false` to hide the route (returns 404). Presets live under `features/calculator/presets/`.

- **project** (default on platform): founder Ring Project Calculator — niche packs, modules, Ringdom externals; prices in credit points converted via `credit.unitToDefaultCurrency` + `credit.desk.pointsPerNativeToken`
- **deployment** (legacy): hours/region estimator constants retained for compatibility

Gate must read `config.calculator?.enabled` — **not** `config.features.calculator`. Hosting selector is `self_host` | `ringdom` (not a delivery/philosophy triad).

## 3. Shared file patches

| File | Change |
|------|--------|
| `lib/i18n.ts` | Add `calculator` locale file id + `messages.calculator` assembly |
| `lib/i18n/message-scopes.ts` | Include `calculator` in `PUBLIC_CONTENT` / `ALL_FILES` |
| `i18n/shared.ts` | Add `'/calculator': '/calculator'` to `sharedPathnames` |
| `lib/ring-config-types.ts` | Top-level `calculator?: { enabled?, presetId? }` |
| `components/navigation/sidebar-*.tsx` | Nav link to `/${locale}/calculator` |
| `ring-config.template.json` | `calculator` section |

## 4. Verify

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/calculator   # 200 when enabled
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/deployment-calculator  # 404
```
