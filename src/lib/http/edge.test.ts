// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clientIpFrom, requestIdFrom } from "./edge";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFrom (review H1)", () => {
  it("counts trusted hops from the right", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), 1)).toBe("203.0.113.9");
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6,203.0.113.9 , 130.211.0.5" }), 2)).toBe("203.0.113.9");
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 2001:db8::1" }), 1)).toBe("2001:db8::1");
  });

  it("trusts nothing with 0 hops, a short header, garbage or X-Real-IP", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9" }), 0)).toBeUndefined();
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9" }), 2)).toBeUndefined();
    expect(clientIpFrom(h({ "x-forwarded-for": "<script>" }), 1)).toBeUndefined();
    expect(clientIpFrom(h({ "x-forwarded-for": "999.1.1.1" }), 1)).toBeUndefined();
    expect(clientIpFrom(h({ "x-real-ip": "203.0.113.9" }), 1)).toBeUndefined();
    expect(clientIpFrom(h({}), 1)).toBeUndefined();
  });
});

describe("requestIdFrom (review L1)", () => {
  it("keeps a UUID and replaces anything else", () => {
    const id = "3B241101-E2BB-4255-8CAF-4136C566A962";
    expect(requestIdFrom(h({ "x-request-id": id }))).toBe(id.toLowerCase());
    const made = requestIdFrom(h({ "x-request-id": 'abc" level=admin' }));
    expect(made).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(requestIdFrom(h({}))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
