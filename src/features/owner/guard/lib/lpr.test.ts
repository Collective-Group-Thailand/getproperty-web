import { describe, expect, it } from "vitest";

import type { PlateDetection } from "./api";
import { lprView } from "./lpr";

const read = (id: string, state: PlateDetection["state"], detectedAt = "2026-11-06T10:00:00+07:00") =>
  ({
    id,
    gateId: "g",
    plate: { category: "1กข", number: "1234", province: null },
    confidence: "0.9",
    detectedAt,
    receivedAt: "2026-11-06T10:20:00+07:00",
    imageRef: null,
    state,
    match: "none",
    unit: null,
    visitId: null,
  }) satisfies PlateDetection;

describe("LPR reads on the desk (D-330)", () => {
  it("offers only pending reads to claim and lists late reads as history, newest first", () => {
    const view = lprView([
      read("p1", "pending"),
      read("h1", "historical", "2026-11-06T09:40:00+07:00"),
      read("c1", "claimed"),
      read("h2", "historical", "2026-11-06T09:55:00+07:00"),
      read("m1", "matched"),
    ]);
    expect(view.claimable.map((entry) => entry.id)).toEqual(["p1"]);
    expect(view.late.map((entry) => entry.id)).toEqual(["h2", "h1"]);
  });

  it("never makes a historical read claimable and caps the history", () => {
    const view = lprView(
      Array.from({ length: 5 }, (_, index) => read(`h${index}`, "historical", `2026-11-06T09:0${index}:00+07:00`)),
    );
    expect(view.claimable).toEqual([]);
    expect(view.late.map((entry) => entry.id)).toEqual(["h4", "h3", "h2"]);
  });
});
