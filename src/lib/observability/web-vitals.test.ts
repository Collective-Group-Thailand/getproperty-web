import { afterEach, describe, expect, it, vi } from "vitest";

const vitals = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onTTFB: vi.fn(),
  onLCP: vi.fn((report: (metric: object) => void) =>
    report({ name: "LCP", value: 1234, rating: "good", id: "v5-1", navigationType: "navigate" }),
  ),
}));
vi.mock("web-vitals", () => vitals);

import { routePattern, startWebVitals } from "./web-vitals";

describe("routePattern (WebVitalDto.route: patterns only, D-180)", () => {
  it("replaces uuids, numbers and long opaque segments with [id]", () => {
    expect(routePattern("/readings/3b241101-e2bb-4255-8caf-4136c566a962")).toBe("/readings/[id]");
    expect(routePattern("/inspections/42/items")).toBe("/inspections/[id]/items");
    expect(routePattern("/devices/abcdefghijklmnopqrstuvwxyz")).toBe("/devices/[id]");
  });

  it("keeps the route words", () => {
    expect(routePattern("/")).toBe("/");
    expect(routePattern("/en/legal/pdpa")).toBe("/en/legal/pdpa");
    expect(routePattern("/devices/install")).toBe("/devices/install");
  });
});

describe("startWebVitals (not part of the first load)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const hide = () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("loads the library on the first interaction, not before", async () => {
    startWebVitals("staff");
    await settle();
    expect(vitals.onLCP).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(vitals.onLCP).toHaveBeenCalledWith(expect.any(Function), { reportAllChanges: false });
  });

  it("on a visit without interaction, loads on hide, reports at once and flushes", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetch);
    startWebVitals("owner");
    hide();
    await settle();
    expect(vitals.onLCP).toHaveBeenCalledWith(expect.any(Function), { reportAllChanges: true });
    // The listeners of the previous case are still on the document: only this zone's call counts.
    const calls = (fetch.mock.calls as unknown as [string, RequestInit][]).filter(([url]) => url.includes("/owner/"));
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe("/bff/v1/owner/telemetry/web-vitals");
    expect(JSON.parse(init.body as string).metrics).toEqual([
      expect.objectContaining({ name: "LCP", id: "v5-1", route: "/" }),
    ]);
  });
});
