import { describe, expect, it } from "vitest";

import { EnvError, parseClientEnv, parseServerEnv } from "./schema";

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

  it("trims a trailing slash from the API URL and refuses a non-http one", () => {
    expect(parseServerEnv({ API_INTERNAL_URL: "http://api:3000/" }).API_INTERNAL_URL).toBe("http://api:3000");
    expect(() => parseServerEnv({ API_INTERNAL_URL: "ftp://api" })).toThrow(/API_INTERNAL_URL/);
  });

  it("validates the sample rate and the public values", () => {
    expect(() => parseServerEnv({ SENTRY_TRACES_SAMPLE_RATE: "2" })).toThrow(/SENTRY_TRACES_SAMPLE_RATE/);
    expect(() => parseServerEnv({ NEXT_PUBLIC_LINE_OA_ID: "getproperty" })).toThrow(/NEXT_PUBLIC_LINE_OA_ID/);
  });
});

describe("parseClientEnv", () => {
  it("hides the badge in production and keeps it elsewhere", () => {
    expect(parseClientEnv({ NEXT_PUBLIC_ENV_BADGE: "production" }).NEXT_PUBLIC_ENV_BADGE).toBeUndefined();
    expect(parseClientEnv({ NEXT_PUBLIC_ENV_BADGE: "uat" }).NEXT_PUBLIC_ENV_BADGE).toBe("uat");
    expect(parseClientEnv({ NEXT_PUBLIC_LINE_OA_ID: "" }).NEXT_PUBLIC_LINE_OA_ID).toBeUndefined();
  });
});
