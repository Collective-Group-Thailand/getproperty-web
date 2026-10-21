import { describe, expect, it } from "vitest";

import { PRIVATE_RANGES } from "@/lib/env/schema";

import { metricsAllowed, metricsCaller, renderMetrics, statusClass, timeBffCall, webMetrics } from "./metrics";

const headers = (forwardedFor?: string) => new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {});

describe("web metrics (D-230)", () => {
  it("renders the Node.js runtime metrics with the service label and the BFF histogram", async () => {
    timeBffCall("owner", "GET")(200);
    timeBffCall("staff", "POST")(502);
    const { contentType, body } = await renderMetrics();
    expect(contentType).toMatch(/^text\/plain/);
    expect(body).toMatch(/process_cpu_user_seconds_total\{service="getproperty-web"\}/);
    expect(body).toMatch(/nodejs_heap_size_used_bytes\{service="getproperty-web"\}/);
    expect(body).toMatch(
      /getproperty_web_bff_request_duration_seconds_count\{service="getproperty-web",zone="owner",method="GET",status="2xx"\} 1/,
    );
    expect(body).toMatch(/zone="staff",method="POST",status="5xx"\} 1/);
    // A route pattern or a raw path never becomes a label.
    expect(body).not.toMatch(/path=|url=/);
  });

  it("keeps one registry per process (route bundles share it)", () => {
    expect(webMetrics()).toBe(webMetrics());
  });

  it("names status classes", () => {
    expect([200, 204, 304, 404, 499, 502].map(statusClass)).toEqual(["2xx", "2xx", "3xx", "4xx", "4xx", "5xx"]);
  });
});

describe("who may scrape /api/metrics", () => {
  it("is the right-most X-Forwarded-For entry: Next's socket peer, or the one Caddy vouches for", () => {
    expect(metricsCaller(headers("172.30.0.12"))).toBe("172.30.0.12");
    expect(metricsCaller(headers("10.9.9.9, 203.0.113.9"))).toBe("203.0.113.9");
    expect(metricsCaller(headers())).toBeUndefined();
  });

  it("admits Alloy on the docker network and loopback, refuses the internet", () => {
    expect(metricsAllowed(headers("172.30.0.12"), PRIVATE_RANGES)).toBe(true);
    expect(metricsAllowed(headers("::ffff:127.0.0.1"), PRIVATE_RANGES)).toBe(true);
    expect(metricsAllowed(headers("203.0.113.9"), PRIVATE_RANGES)).toBe(false);
    // A client cannot prepend a private address: only the right-most entry counts.
    expect(metricsAllowed(headers("172.30.0.12, 203.0.113.9"), PRIVATE_RANGES)).toBe(false);
    expect(metricsAllowed(headers(), PRIVATE_RANGES)).toBe(false);
    expect(metricsAllowed(headers("172.30.0.12"), "127.0.0.0/8")).toBe(false);
  });
});
