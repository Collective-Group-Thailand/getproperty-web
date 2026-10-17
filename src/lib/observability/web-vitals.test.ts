import { describe, expect, it } from "vitest";

import { routePattern } from "./web-vitals";

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
