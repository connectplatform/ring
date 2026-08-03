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

      // Ring Oracle SSOT — prefer @/lib/ring-oracle over deep rate modules.
      // Implementations + the facade itself are exempt below.
      "no-restricted-imports": [
        "warn",
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
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig; 