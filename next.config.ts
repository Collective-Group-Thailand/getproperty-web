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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
