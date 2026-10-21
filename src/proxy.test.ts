import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetServerEnv } from "@/lib/env/server";
import { DEFAULT_HOSTS, hostname, isReservedPath, resolveZone, zoneHosts } from "@/lib/zones";

import { config, NOT_FOUND_PATH, proxy, routeRequest } from "./proxy";

const hosts = zoneHosts({});

describe("hostname", () => {
  it("drops the port and lower-cases", () => {
    expect(hostname("Staff.localhost:3000")).toBe("staff.localhost");
    expect(hostname(null)).toBe("");
  });
});

describe("zoneHosts", () => {
  it("defaults to *.localhost and reads the env", () => {
    expect(hosts).toEqual(DEFAULT_HOSTS);
    expect(zoneHosts({ STAFF_HOST: "staff.getproperty.co:443", OWNER_HOST: "my.getproperty.co" })).toMatchObject({
      staff: "staff.getproperty.co",
      owner: "my.getproperty.co",
      admin: "admin.localhost",
    });
  });
});

describe("resolveZone", () => {
  it("maps each host to its zone, ignoring the port", () => {
    expect(resolveZone("localhost:3000", hosts)).toBe("owner");
    expect(resolveZone("staff.localhost", hosts)).toBe("staff");
    expect(resolveZone("admin.localhost:3000", hosts)).toBe("admin");
  });
  it("returns null for an unknown host", () => {
    expect(resolveZone("evil.example", hosts)).toBeNull();
  });
  it("has no resident zone — the resident app is getproperty-liff (D-154)", () => {
    expect(resolveZone("tenant.localhost:3000", hosts)).toBeNull();
    expect(Object.keys(hosts)).toEqual(["owner", "staff", "admin"]);
  });
});

describe("isReservedPath", () => {
  it.each(["/staff", "/staff/x", "/admin", "/ADMIN/tenants", "/tenant", "/resident/home", "/%73taff/x", "/staff./x"])(
    "%s is reserved",
    (path) => expect(isReservedPath(path)).toBe(true),
  );
  it.each(["/", "/staffing", "/dashboard", "/en/staff", "/bff/v1/owner/me"])("%s is not reserved", (path) =>
    expect(isReservedPath(path)).toBe(false),
  );
});

describe("routeRequest", () => {
  const at = (host: string, path: string, enabled?: ("owner" | "staff" | "admin")[]) =>
    routeRequest(new URL(`http://${host}${path}`), host, hosts, enabled);

  it("hands owner pages to next-intl", () => {
    expect(at("localhost:3000", "/dashboard")).toMatchObject({ zone: "owner", kind: "intl" });
    expect(at("localhost:3000", "/en")).toMatchObject({ zone: "owner", kind: "intl" });
  });

  it("serves the owner BFF and root files outside [locale]", () => {
    expect(at("localhost:3000", "/bff/v1/owner/me")).toMatchObject({ kind: "asset" });
    expect(at("localhost:3000", "/robots.txt")).toMatchObject({ kind: "asset" });
    expect(at("localhost:3000", "/sitemap.xml")).toMatchObject({ kind: "asset" });
  });

  it("prefixes the other zones' paths with their segment — including their own /bff", () => {
    expect(at("staff.localhost:3000", "/")!.url.pathname).toBe("/staff");
    expect(at("staff.localhost:3000", "/today")!.url.pathname).toBe("/staff/today");
    expect(at("staff.localhost:3000", "/bff/v1/staff/me")!.url.pathname).toBe("/staff/bff/v1/staff/me");
    expect(at("admin.localhost:3000", "/bff/v1/admin/me")!.url.pathname).toBe("/admin/bff/v1/admin/me");
    // Keys with a dot (settings, feature flags) stay on their zone's BFF.
    expect(at("admin.localhost:3000", "/bff/v1/admin/feature-flags/billing.auto_issue")!.url.pathname).toBe(
      "/admin/bff/v1/admin/feature-flags/billing.auto_issue",
    );
    const tenants = at("admin.localhost:3000", "/tenants?page=2")!;
    expect(tenants.url.pathname).toBe("/admin/tenants");
    expect(tenants.url.search).toBe("?page=2");
  });

  it("refuses another zone's segment and the retired resident segments on every host", () => {
    expect(at("localhost:3000", "/staff")).toMatchObject({ kind: "not-found" });
    expect(at("localhost:3000", "/staff")!.url.pathname).toBe(`/th${NOT_FOUND_PATH}`);
    expect(at("localhost:3000", "/admin/tenants")).toMatchObject({ kind: "not-found" });
    expect(at("staff.localhost:3000", "/admin")!.url.pathname).toBe(`/staff${NOT_FOUND_PATH}`);
    expect(at("admin.localhost:3000", "/staff/bff/v1/staff/me")!.url.pathname).toBe(`/admin${NOT_FOUND_PATH}`);
    for (const host of ["localhost:3000", "staff.localhost:3000", "admin.localhost:3000"]) {
      expect(at(host, "/tenant")).toMatchObject({ kind: "not-found" });
      expect(at(host, "/resident/invoices")).toMatchObject({ kind: "not-found" });
    }
  });

  it("passes root assets through unprefixed on every host", () => {
    expect(at("admin.localhost:3000", "/favicon.ico")!.url.pathname).toBe("/favicon.ico");
    expect(at("staff.localhost:3000", "/brand/wordmark.svg")!.url.pathname).toBe("/brand/wordmark.svg");
  });

  it("answers no unknown host and no disabled zone", () => {
    expect(at("preview.example", "/x")).toBeNull();
    expect(at("tenant.localhost:3000", "/")).toBeNull();
    expect(at("admin.localhost:3000", "/", ["owner", "staff"])).toBeNull();
    expect(at("localhost:3000", "/", ["owner", "staff"])).toMatchObject({ zone: "owner" });
  });
});

describe("proxy", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, {
      OWNER_HOST: "localhost:3000",
      STAFF_HOST: "staff.localhost:3000",
      ADMIN_HOST: "admin.localhost:3000",
      ZONES: "",
    });
    resetServerEnv();
  });
  afterEach(() => {
    process.env = { ...saved };
    resetServerEnv();
  });

  const call = (host: string, path: string) => proxy(new NextRequest(`http://${host}${path}`, { headers: { host } }));

  it("404s an unknown host with no page", async () => {
    const response = await call("evil.example", "/");
    expect(response.status).toBe(404);
  });

  it("rewrites the staff host and sets the staff security headers", async () => {
    const response = await call("staff.localhost:3000", "/readings");
    expect(response.headers.get("x-middleware-rewrite")).toContain("/staff/readings");
    expect(response.headers.get("x-gp-zone")).toBe("staff");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=(self)");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("worker-src 'self'");
    expect(csp).not.toMatch(/line\.me|liff/i);
  });

  it("gives admin the strictest policy and noindex everywhere", async () => {
    const response = await call("admin.localhost:3000", "/");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("worker-src 'none'");
    expect(csp).not.toContain("blob:");
  });

  it("lets only the owner marketing pages be indexed", async () => {
    expect((await call("localhost:3000", "/")).headers.get("X-Robots-Tag")).toBeNull();
    expect((await call("localhost:3000", "/en/pricing")).headers.get("X-Robots-Tag")).toBeNull();
    expect((await call("localhost:3000", "/dashboard")).headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect((await call("localhost:3000", "/login")).headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("uses a fresh nonce per request", async () => {
    const nonce = async () =>
      /'nonce-([^']+)'/.exec((await call("localhost:3000", "/")).headers.get("Content-Security-Policy")!)![1];
    expect(await nonce()).not.toBe(await nonce());
  });
});

describe("config.matcher", () => {
  const runs = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("runs the proxy for every BFF call, dots included (the static-file pattern would skip them)", () => {
    expect(runs("/bff/v1/owner/settings/reminders.schedule")).toBe(true);
    expect(runs("/bff/v1/admin/feature-flags/billing.auto_issue")).toBe(true);
  });

  it.each([
    "/admin/bff/v1/admin/x.y",
    "/staff/bff/v1/staff/me.json",
    "/staff/work-orders/a.b",
    "/work-orders/a.b",
    "/en/units/A.101",
    "/tenant/x.y",
    "/resident/a.b",
    "/x.php",
    "/sw.js",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/icon.svg",
    "/",
    "/dashboard",
  ])("runs for %s (review L3: reserved segments, zone rewrite, CSP on dotted paths too)", (url) => {
    expect(runs(url)).toBe(true);
  });

  it.each(["/_next/static/chunks/main.js", "/_next/image?url=x", "/pwa/staff-192.png", "/brand/wordmark.svg"])(
    "leaves Next internals and the public folders alone: %s",
    (url) => {
      expect(runs(url)).toBe(false);
    },
  );
});

describe("dotted paths (review L3)", () => {
  const call = (host: string, path: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } }));

  it("404 another zone's segment and stamp the security headers", async () => {
    for (const [host, path] of [
      ["localhost:3000", "/admin/bff/v1/admin/x.y"],
      ["admin.localhost:3000", "/staff/work-orders/a.b"],
      ["staff.localhost:3000", "/admin/x.y"],
    ] as const) {
      const response = await call(host, path);
      expect(response.headers.get("x-middleware-rewrite") ?? "").toContain(NOT_FOUND_PATH);
      expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    }
  });

  it("overwrites client-sent zone and path headers", async () => {
    const response = await call("staff.localhost:3000", "/work-orders/a.b", { "x-gp-zone": "admin" });
    expect(response.headers.get("x-gp-zone")).toBe("staff");
    expect(response.headers.get("x-middleware-request-x-gp-zone")).toBe("staff");
  });
});
