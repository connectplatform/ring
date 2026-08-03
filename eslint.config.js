import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      
      // JavaScript rules
      "prefer-const": "off",
      "no-var": "off",
      
      // React rules
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      
      // Next.js rules
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",

      // Ring Oracle SSOT — error so CI blocks regressive deep rate imports.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/features/wallet/services/native-token-oracle",
              message:
                "Import finance rates from @/lib/ring-oracle (desk SSOT). Implementation modules may keep deep imports.",
            },
            {
              name: "@/lib/fx/fx-feed-service",
              message:
                "Import FX feed helpers from @/lib/ring-oracle. Overlay (fx-rates-overlay) stays shared with ring-config-core.",
            },
            {
              name: "@/features/public-pools/lib/public-pool-desk-fx",
              message:
                "Deleted — use @/lib/ring-oracle (mainCurrencyToNativeTokenUiWithMeta / nativeTokenUiToMainCurrencyWithMeta).",
            },
            {
              name: "@/lib/payments/credit-balance",
              message:
                "Import credit rate helpers from @/lib/ring-oracle (server). Client: credit-balance-client or ring-config-core.",
            },
          ],
        },
      ],
    },
  },
  {
    // Facade + implementations may deep-import rate modules.
    files: [
      "lib/ring-oracle/**",
      "features/wallet/services/native-token-oracle.ts",
      "features/wallet/services/native-token-chainlink-oracle.ts",
      "lib/fx/**",
      "lib/payments/credit-balance.ts",
      "lib/processes/fx/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
