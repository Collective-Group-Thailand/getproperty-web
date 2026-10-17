import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";
import type { QueueEntry } from "@/lib/pwa/queue";

import { roundView } from "./roundState";

const item = (id: string, unitNo: string): Schemas["RoundItemDto"] => ({
  assetItemId: id,
  meterAssignmentId: `ma-${id}`,
  code: `E-${unitNo}`,
  utility: "electric",
  purpose: "unit",
  unitId: `u-${id}`,
  unitNo,
  iot: false,
  health: null,
  lastReading: null,
});

const round: Schemas["RoundBuildingDto"] = {
  buildingId: "b1",
  buildingName: "A",
  periodKey: "2026-10",
  cutoffAt: "2026-10-25T00:00:00+07:00",
  windowStart: "2026-10-18T00:00:00+07:00",
  batchId: null,
  remaining: 3,
  floors: [
    { floorId: "f2", floorName: "2", level: 2, items: [item("m1", "A-201"), item("m2", "A-202")] },
    { floorId: "f3", floorName: "3", level: 3, items: [item("m3", "A-301")] },
  ],
};

let clock = 0;
const entry = (assetItemId: string, state: QueueEntry["state"], extra: Partial<QueueEntry> = {}): QueueEntry => ({
  id: `e-${assetItemId}-${(clock += 1)}`,
  idempotencyKey: "k",
  method: "POST",
  path: "/v1/staff/meter-readings",
  body: {},
  label: assetItemId,
  createdAt: clock,
  attempts: 0,
  nextAttemptAt: 0,
  state,
  meta: {
    kind: "meter-reading",
    assetItemId,
    buildingId: "b1",
    periodKey: "2026-10",
    unitNo: null,
    code: assetItemId,
    utility: "electric",
    typedValue: "1",
  },
  ...extra,
});

describe("roundView", () => {
  it("is the API's round when this device has queued nothing", () => {
    const view = roundView(round, []);
    expect(view.remaining.map((group) => group.items.length)).toEqual([2, 1]);
    expect(view).toMatchObject({ done: 0, total: 3 });
    expect(view.next(null)?.assetItemId).toBe("m1");
  });

  it("takes a meter out of the list as soon as a reading is queued or sent, offline too", () => {
    const view = roundView(round, [entry("m1", "pending"), entry("m3", "sent")]);
    expect(view.remaining.map((group) => group.items.map((i) => i.assetItemId))).toEqual([["m2"]]);
    expect(view).toMatchObject({ done: 2, total: 3 });
    expect(view.next("m1")?.assetItemId).toBe("m2");
  });

  it("keeps a refused meter in the list (to fix) and does not count it as done", () => {
    const view = roundView(round, [entry("m2", "conflict")]);
    expect(view.remaining.flatMap((group) => group.items).map((i) => i.assetItemId)).toContain("m2");
    expect(view.done).toBe(0);
    expect(view.local).toHaveLength(1);
  });

  it("uses the newest entry per meter and ignores other buildings and periods", () => {
    const old = entry("m2", "conflict");
    const fixed = entry("m2", "sent");
    const otherBuilding = entry("m1", "sent", {
      meta: { ...entry("m1", "sent").meta!, buildingId: "b2" },
    });
    const otherPeriod = entry("m3", "sent", { meta: { ...entry("m3", "sent").meta!, periodKey: "2026-09" } });
    const view = roundView(round, [old, fixed, otherBuilding, otherPeriod]);
    expect(view.local.map((e) => e.id)).toEqual([fixed.id]);
    expect(view).toMatchObject({ done: 1, total: 3 });
  });

  it("a reading taken before the round's window does not count: the meter stays, marked early", () => {
    const before = entry("m1", "sent", { body: { readAt: "2026-10-10T09:00:00+07:00" } });
    const inside = entry("m2", "sent", { body: { readAt: "2026-10-20T09:00:00+07:00" } });
    const view = roundView(round, [before, inside]);
    expect(view.early.has(before.id)).toBe(true);
    expect(view.early.has(inside.id)).toBe(false);
    expect(view.remaining.flatMap((group) => group.items).map((i) => i.assetItemId)).toEqual(["m1", "m3"]);
    expect(view).toMatchObject({ done: 1, total: 3 });
  });

  it("next() wraps around and returns null when everything is handled", () => {
    expect(roundView(round, [entry("m1", "sent")]).next("m3")?.assetItemId).toBe("m2");
    expect(roundView(round, [entry("m1", "sent"), entry("m2", "sent"), entry("m3", "sent")]).next("m3")).toBeNull();
  });
});
