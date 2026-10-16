import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Storybook is the design system's documentation and visual workbench (design-system.md §9). The a11y
 * *gate* runs in Vitest (`src/ui/test/stories.a11y.test.tsx`) and Playwright, not here — addon-a11y
 * keeps axe one panel away while a component is being built.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/ui/docs/**/*.mdx", "../src/ui/**/*.stories.@(ts|tsx)", "../src/features/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  // `next/font` cannot run under Vite, so the same five woff2 files are declared by hand in
  // .storybook/fonts.css and served from here.
  staticDirs: [
    { from: "../src/ui/fonts/files", to: "/fonts" },
    { from: "../public", to: "/" },
  ],
  typescript: { reactDocgen: "react-docgen-typescript" },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    css: { ...viteConfig.css, postcss: { plugins: [] } },
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        "@/ui": join(root, "src/ui"),
        "@/domain": join(root, "src/domain"),
        "@/i18n": join(root, "src/i18n"),
        "@/lib": join(root, "src/lib"),
        "@/features": join(root, "src/features"),
        "@": join(root, "src"),
      },
    },
  }),
};

export default config;
