import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Unit and component tests. jsdom for React Testing Library and the axe gate; `scripts/**` and
 * `eslint-rules/**` are included so the contrast gate and the rule fixtures run in `pnpm test`.
 */
export default defineConfig({
  plugins: [react()],
  // The Storybook preview imports its CSS; an inline (empty) PostCSS config stops Vite reading
  // postcss.config.mjs, whose string-plugin form is Turbopack's and not Vite's.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@/ui": `${root}src/ui`,
      "@/features": `${root}src/features`,
      "@/lib": `${root}src/lib`,
      "@/domain": `${root}src/domain`,
      "@/i18n": `${root}src/i18n`,
      "@": `${root}src`,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/ui/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "eslint-rules/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e", "storybook-static"],
    css: false,
  },
});
