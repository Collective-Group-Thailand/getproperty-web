/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetServerEnv } from "@/lib/env/server";

import { GET as healthz, HEAD as healthzHead } from "./healthz/route";
import { GET as metrics } from "./metrics/route";

/** The two container endpoints of the Collective platform's image contract (D-230). */
describe("GET /api/healthz", () => {
  it("answers 200 without a session, cache or index", async () => {
    const response = healthz();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(healthzHead().status).toBe(200);
  });
});

describe("GET /api/metrics", () => {
  const saved = { ...process.env };
  beforeEach(() => resetServerEnv());
  afterEach(() => {
    process.env = { ...saved };
    resetServerEnv();
  });
  const scrape = (forwardedFor?: string) =>
    metrics(
      new Request("http://172.30.0.7:3000/api/metrics", {
        headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
      }),
    );

  it("serves Prometheus text to Alloy on the docker network", async () => {
    const response = await scrape("172.30.0.3");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(await response.text()).toContain("nodejs_heap_size_used_bytes");
  });

  it("is a plain 404 for anyone else, and follows METRICS_ALLOWED_CIDRS", async () => {
    expect((await scrape("203.0.113.9")).status).toBe(404);
    expect((await scrape()).status).toBe(404);
    process.env.METRICS_ALLOWED_CIDRS = "127.0.0.0/8";
    resetServerEnv();
    expect((await scrape("172.30.0.3")).status).toBe(404);
    expect((await scrape("127.0.0.1")).status).toBe(200);
  });
});
