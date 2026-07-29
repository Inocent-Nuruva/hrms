import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["desktop/**/*.cjs", "android/scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["android/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: [
      "src/components/animate-ui/icons/icon.tsx",
      "src/components/animate-ui/primitives/animate/slot.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: [
      "src/components/dashboard/**/*.tsx",
      "src/components/data-table.tsx",
      "src/app/dashboard/attendance/[view]/page.tsx",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/code/**",
  ]),
]);

export default eslintConfig;
