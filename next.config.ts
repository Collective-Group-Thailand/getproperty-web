import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md is hand-written project documentation; Next 16 would otherwise overwrite it with
  // generated agent rules.
  agentRules: false,
  // Each zone is served by its own `<html>` root layout; nothing here is zone-specific. The
  // host → zone rewrite lives in src/proxy.ts.
  poweredByHeader: false,
  // Responses the proxy never sees (public files, Next's static assets) still get the baseline that
  // does not depend on the zone; pages get the full per-zone set from src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing of this app is ever framed (the proxy's CSP says `frame-ancestors 'none'` too, review L3).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    // D-179: every catalog under src/i18n/messages is compiled from ICU to a compact AST at build time
    // and the client gets next-intl's format-only runtime — no ICU parser in any bundle. The JSON files
    // stay the source (tests, Storybook and `messages.test.ts` read them as written).
    messages: { path: "./src/i18n/messages", format: "json", locales: "infer", precompile: true },
  },
});

// `pnpm analyze` (ANALYZE=true, webpack build): treemaps of every client chunk in `.next/analyze/`.
// The Turbopack build that ships has its own viewer, `pnpm exec next analyze`.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true", openAnalyzer: false });

export default withBundleAnalyzer(withNextIntl(nextConfig));
