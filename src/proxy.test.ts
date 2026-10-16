import { describe, expect, it } from "vitest";

import { DEFAULT_HOSTS, hostname, resolveZone, zoneHosts } from "@/lib/zones";

import { zoneRewrite } from "./proxy";

const hosts = zoneHosts({});

describe("hostname", () => {
  it("drops the port and lower-cases", () => {
    expect(hostname("Tenant.localhost:3000")).toBe("tenant.localhost");
    expect(hostname(null)).toBe("");
  });
});

describe("zoneHosts", () => {
  it("defaults to *.localhost and reads the env", () => {
    expect(hosts).toEqual(DEFAULT_HOSTS);
    expect(zoneHosts({ TENANT_HOST: "app.getproperty.co:443", OWNER_HOST: "my.getproperty.co" })).toMatchObject({
      tenant: "app.getproperty.co",
      owner: "my.getproperty.co",
      staff: "staff.localhost",
    });
  });
});

describe("resolveZone", () => {
  it("maps each host to its zone, ignoring the port", () => {
    expect(resolveZone("localhost:3000", hosts)).toBe("owner");
    expect(resolveZone("tenant.localhost:3100", hosts)).toBe("tenant");
    expect(resolveZone("staff.localhost", hosts)).toBe("staff");
    expect(resolveZone("admin.localhost:3000", hosts)).toBe("admin");
  });
  it("returns null for an unknown host", () => {
    expect(resolveZone("evil.example", hosts)).toBeNull();
  });
});

describe("zoneRewrite", () => {
  const at = (host: string, path: string) => zoneRewrite(new URL(`http://${host}${path}`), host, hosts);

  it("prefixes the owner host's paths with the default locale unless one is given", () => {
    const { zone, url } = at("localhost:3000", "/dashboard");
    expect(zone).toBe("owner");
    expect(url.pathname).toBe("/th/dashboard");
    expect(at("localhost:3000", "/").url.pathname).toBe("/th");
    expect(at("localhost:3000", "/en/dashboard").url.pathname).toBe("/en/dashboard");
    expect(at("localhost:3000", "/th").url.pathname).toBe("/th");
  });

  it("prefixes the other zones' paths with their segment", () => {
    expect(at("tenant.localhost:3000", "/").url.pathname).toBe("/tenant");
    expect(at("tenant.localhost:3000", "/bills/42").url.pathname).toBe("/tenant/bills/42");
    expect(at("staff.localhost:3000", "/today").url.pathname).toBe("/staff/today");
    expect(at("admin.localhost:3000", "/orgs?page=2").url.pathname).toBe("/admin/orgs");
    expect(at("admin.localhost:3000", "/orgs?page=2").url.search).toBe("?page=2");
  });

  it("passes root assets through unprefixed on every host", () => {
    expect(at("tenant.localhost:3000", "/favicon.ico").url.pathname).toBe("/favicon.ico");
    expect(at("staff.localhost:3000", "/brand/wordmark.svg").url.pathname).toBe("/brand/wordmark.svg");
  });

  it("serves an unknown host as the owner zone in F0", () => {
    expect(at("preview.example", "/x").zone).toBe("owner");
  });
});
