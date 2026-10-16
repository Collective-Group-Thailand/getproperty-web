import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md is hand-written project documentation; Next 16 would otherwise overwrite it with
  // generated agent rules.
  agentRules: false,
  // Each zone is served by its own `<html>` root layout; nothing here is zone-specific. The
  // host → zone rewrite lives in src/proxy.ts.
  poweredByHeader: false,
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
