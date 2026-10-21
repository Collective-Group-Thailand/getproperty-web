import { describe, expect, it } from "vitest";

import { buildCsp, permissionsPolicy, securityHeaders, sentryOriginFromDsn } from "./headers";

const base = { nonce: "abc", dev: false } as const;

describe("buildCsp", () => {
  it("is nonce-based with strict-dynamic and no inline script", () => {
    const csp = buildCsp({ ...base, zone: "owner" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("adds eval and HMR only in development", () => {
    const csp = buildCsp({ ...base, zone: "owner", dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows the asset and Sentry origins where files and errors go", () => {
    const csp = buildCsp({
      ...base,
      zone: "staff",
      assetOrigin: "https://collective-uat-getproperty-assets.s3.ap-southeast-7.amazonaws.com",
      sentryOrigin: sentryOriginFromDsn("https://key@o1.ingest.sentry.io/42"),
    });
    const bucket = "https://collective-uat-getproperty-assets\\.s3\\.ap-southeast-7\\.amazonaws\\.com";
    expect(csp).toMatch(new RegExp(`img-src [^;]*${bucket}`));
    expect(csp).toMatch(new RegExp(`connect-src [^;]*${bucket} [^;]*https://o1\\.ingest\\.sentry\\.io`));
  });

  it("gives only staff a worker and blob media", () => {
    expect(buildCsp({ ...base, zone: "staff" })).toContain("worker-src 'self'");
    expect(buildCsp({ ...base, zone: "owner" })).toContain("worker-src 'none'");
    expect(buildCsp({ ...base, zone: "admin" })).not.toContain("blob:");
  });

  it("frames only blob: PDFs, and only in the owner console's document viewer (F2)", () => {
    const frame = (zone: "owner" | "staff" | "admin") =>
      buildCsp({ zone, nonce: "n", dev: false }).match(/frame-src ([^;]+)/)?.[1];
    expect(frame("owner")).toBe("blob:");
    expect(frame("staff")).toBe("'none'");
    expect(frame("admin")).toBe("'none'");
    expect(buildCsp({ zone: "owner", nonce: "n", dev: false })).toContain("frame-ancestors 'none'");
  });

  it("never allows a LINE or LIFF origin (D-154)", () => {
    for (const zone of ["owner", "staff", "admin"] as const) {
      expect(buildCsp({ ...base, zone })).not.toMatch(/line\.me|lin\.ee|liff/i);
    }
  });
});

describe("permissionsPolicy", () => {
  it("grants the camera to the staff host only", () => {
    expect(permissionsPolicy("staff")).toContain("camera=(self)");
    expect(permissionsPolicy("owner")).toContain("camera=()");
    expect(permissionsPolicy("admin")).toContain("camera=()");
  });
});

describe("securityHeaders", () => {
  it("sets HSTS only when asked and noindex unless indexable", () => {
    const prod = securityHeaders({ ...base, zone: "owner", indexable: true, hsts: true });
    expect(prod["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(prod["X-Robots-Tag"]).toBeUndefined();
    const dev = securityHeaders({ ...base, zone: "admin", indexable: false, hsts: false });
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
    expect(dev["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(dev["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
