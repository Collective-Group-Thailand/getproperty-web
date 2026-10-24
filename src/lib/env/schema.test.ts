import { describe, expect, it } from "vitest";

import { EnvError, ipAllowed, parseCidrList, parsePublicEnv, parseServerEnv, PRIVATE_RANGES } from "./schema";

describe("parseServerEnv", () => {
  it("defaults the hosts and API URL outside production", () => {
    const env = parseServerEnv({ NODE_ENV: "development" });
    expect(env.OWNER_HOST).toBe("localhost:3000");
    expect(env.STAFF_HOST).toBe("staff.localhost:3000");
    expect(env.API_INTERNAL_URL).toBe("http://localhost:4000");
    expect(env.ZONES).toEqual(["owner", "staff", "admin"]);
  });

  it("requires every host and the API URL in production, listing all of them", () => {
    try {
      parseServerEnv({ NODE_ENV: "production" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const text = (error as EnvError).issues.join("\n");
      for (const name of ["OWNER_HOST", "STAFF_HOST", "ADMIN_HOST", "API_INTERNAL_URL"]) expect(text).toContain(name);
    }
  });

  it("parses ZONES and refuses an unknown zone (no resident zone, D-154)", () => {
    expect(parseServerEnv({ ZONES: "staff, owner" }).ZONES).toEqual(["owner", "staff"]);
    expect(() => parseServerEnv({ ZONES: "owner,tenant" })).toThrow(/tenant/);
  });

  it("refuses hosts with a scheme and duplicate hosts", () => {
    expect(() => parseServerEnv({ OWNER_HOST: "https://my.getproperty.co" })).toThrow(/OWNER_HOST/);
    expect(() => parseServerEnv({ OWNER_HOST: "a.test", STAFF_HOST: "a.test:3000" })).toThrow(/different hosts/);
  });

  it("takes an optional MARKETING_HOST that must differ from the zone hosts", () => {
    expect(parseServerEnv({}).MARKETING_HOST).toBeUndefined();
    expect(parseServerEnv({ MARKETING_HOST: "" }).MARKETING_HOST).toBeUndefined();
    expect(parseServerEnv({ MARKETING_HOST: " GetProperty.app " }).MARKETING_HOST).toBe("getproperty.app");
    expect(() => parseServerEnv({ MARKETING_HOST: "https://getproperty.app" })).toThrow(/MARKETING_HOST/);
    expect(() => parseServerEnv({ OWNER_HOST: "a.test", MARKETING_HOST: "a.test" })).toThrow(/different hosts/);
  });

  it("trims a trailing slash from the API URL and refuses a non-http one", () => {
    expect(parseServerEnv({ API_INTERNAL_URL: "http://api:3000/" }).API_INTERNAL_URL).toBe("http://api:3000");
    expect(() => parseServerEnv({ API_INTERNAL_URL: "ftp://api" })).toThrow(/API_INTERNAL_URL/);
  });

  it("validates the sample rate and the public values", () => {
    expect(() => parseServerEnv({ SENTRY_TRACES_SAMPLE_RATE: "2" })).toThrow(/SENTRY_TRACES_SAMPLE_RATE/);
    expect(() => parseServerEnv({ NEXT_PUBLIC_LINE_OA_ID: "getproperty" })).toThrow(/NEXT_PUBLIC_LINE_OA_ID/);
  });
});

describe("the platform's real hostnames (collective-infra caddy/sites.<env>.yml, D-230)", () => {
  it("accepts the UAT and production hosts as the platform compose file passes them", () => {
    for (const [owner, staff, admin] of [
      ["uat-app.getproperty.example", "uat-staff.getproperty.example", "uat-admin.getproperty.example"],
      ["app.getproperty.co", "staff.getproperty.co", "admin.getproperty.co"],
    ]) {
      const env = parseServerEnv({
        NODE_ENV: "production",
        OWNER_HOST: owner,
        STAFF_HOST: staff,
        ADMIN_HOST: admin,
        API_INTERNAL_URL: "http://getproperty-api:3000",
        TRUSTED_HOPS: "1",
      });
      expect([env.OWNER_HOST, env.STAFF_HOST, env.ADMIN_HOST]).toEqual([owner, staff, admin]);
      expect(env.API_INTERNAL_URL).toBe("http://getproperty-api:3000");
      expect(env.TRUSTED_HOPS).toBe(1);
    }
  });
});

describe("METRICS_ALLOWED_CIDRS", () => {
  it("defaults to loopback and the private ranges (the docker network) like the API", () => {
    const env = parseServerEnv({});
    expect(env.METRICS_ALLOWED_CIDRS).toBe(PRIVATE_RANGES);
    const list = parseCidrList(env.METRICS_ALLOWED_CIDRS);
    for (const ip of ["127.0.0.1", "172.30.4.7", "10.1.2.3", "192.168.1.9", "::1", "::ffff:172.30.0.5", "fd00::1"])
      expect(ipAllowed(list, ip), ip).toBe(true);
    for (const ip of ["203.0.113.9", "8.8.8.8", "2001:db8::1", "::ffff:203.0.113.9", "not-an-ip", undefined])
      expect(ipAllowed(list, ip), String(ip)).toBe(false);
  });

  it("takes the platform's value and refuses an invalid entry", () => {
    const list = parseCidrList(
      parseServerEnv({ METRICS_ALLOWED_CIDRS: "172.30.0.0/16, 127.0.0.0/8" }).METRICS_ALLOWED_CIDRS,
    );
    expect(ipAllowed(list, "172.30.9.9")).toBe(true);
    expect(ipAllowed(list, "10.0.0.1")).toBe(false);
    expect(() => parseServerEnv({ METRICS_ALLOWED_CIDRS: "172.30.0.0/40" })).toThrow(/METRICS_ALLOWED_CIDRS/);
    expect(() => parseServerEnv({ METRICS_ALLOWED_CIDRS: "everyone" })).toThrow(/METRICS_ALLOWED_CIDRS/);
  });
});

describe("parsePublicEnv", () => {
  it("hides the badge in production and keeps it elsewhere", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_ENV_BADGE: "production" }).NEXT_PUBLIC_ENV_BADGE).toBeUndefined();
    expect(parsePublicEnv({ NEXT_PUBLIC_ENV_BADGE: "uat" }).NEXT_PUBLIC_ENV_BADGE).toBe("uat");
    expect(parsePublicEnv({ NEXT_PUBLIC_LINE_OA_ID: "" }).NEXT_PUBLIC_LINE_OA_ID).toBeUndefined();
  });
});
