import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "*.config.{js,mjs,ts}",
    ],
  },
  // next/core-web-vitals registers react, react-hooks, jsx-a11y and @next/next.
  ...compat.extends("next/core-web-vitals"),
  // jsx-a11y strict rules on top (the plugin itself is already registered above).
  { rules: jsxA11y.flatConfigs.strict.rules },
  // typescript-eslint strict, type-aware (replaces next/typescript; REVIEW D-06, C-06).
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // Tests poke at parsed JSON and DOM lookups they have just asserted exist.
    files: ["**/*.test.{ts,tsx}", "e2e/**"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // `await act(async () => ...)` flushes React 19 updates even when the body is synchronous.
      "@typescript-eslint/require-await": "off",
    },
  },
);

export default config;
