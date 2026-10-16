import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...tseslint.configs.recommended,
  { files:["**/*.{ts,tsx,js,mjs}"], plugins:{"@next/next":nextPlugin}, rules:{...nextPlugin.configs.recommended.rules,...nextPlugin.configs["core-web-vitals"].rules} },
  reactHooks.configs.flat.recommended,
  globalIgnores([".next/**", "out/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
