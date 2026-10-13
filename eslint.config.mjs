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
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["android/scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // CommonJS script/config files (.cjs) legitimately use require().
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "android/dist/**",
    "next-env.d.ts",
    "public/code/**",
  ]),
]);

export default eslintConfig;
