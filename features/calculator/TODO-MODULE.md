# Calculator Module — Install Checklist

Modeled on `scripts/install-refcodes-module.sh`. Copy the generic calculator engine into a Ring clone and enable via `ring-config.json`.

## 1. Copy verbatim

```bash
CANON=/path/to/ring-platform.org
TARGET=/path/to/ring-clone

cp -R "$CANON/features/calculator" "$TARGET/features/calculator"
cp "$CANON/app/(public)/[locale]/calculator/page.tsx" "$TARGET/app/(public)/[locale]/calculator/page.tsx"
cp "$CANON/lib/ring-config.ts" "$TARGET/lib/ring-config.ts"
cp "$CANON/locales/en/calculator.json" "$TARGET/locales/en/calculator.json"
cp "$CANON/locales/uk/calculator.json" "$TARGET/locales/uk/calculator.json"
cp "$CANON/locales/ru/calculator.json" "$TARGET/locales/ru/calculator.json"
```

## 2. ring-config.json

```json
"calculator": {
  "enabled": true,
  "presetId": "deployment"
}
```

Set `"enabled": false` to hide the route (returns 404). Add clone-specific presets under `features/calculator/presets/`.

## 3. Shared file patches

| File | Change |
|------|--------|
| `lib/i18n.ts` | Add `calculator` locale file id + `messages.calculator` assembly |
| `lib/i18n/message-scopes.ts` | Include `calculator` in `PUBLIC_CONTENT` / `ALL_FILES` |
| `i18n/shared.ts` | Add `'/calculator': '/calculator'` to `sharedPathnames` |
| `components/navigation/sidebar-*.tsx` | Nav link to `/${locale}/calculator` |
| `ring-config.template.json` | `calculator`, `sidebar`, `contact`, `productFields` sections |

## 4. Optional presets

- **deployment** (bundled): platform setup time/cost estimator
- Clone-specific: add `features/calculator/presets/<id>.ts` + locale keys under `calculator.presets.<id>`

## 5. Verify

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/calculator   # 200 when enabled
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/deployment-calculator  # 404
```
