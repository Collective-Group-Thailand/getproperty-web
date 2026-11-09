import { describe, expect, it } from "vitest";

import {
  candidatePath,
  direction,
  lineState,
  nextLineAfter,
  queueOrder,
  queueProgress,
  rankSuggestions,
  selectLine,
} from "./matching";

const line = (id: string, bookedOn: string, lineNo: number, matchKind = "none", amount = "100.00") => ({
  id,
  bookedOn,
  lineNo,
  matchKind,
  amount,
});

const LINES = [
  line("c", "2026-10-03", 3, "payment"),
  line("a", "2026-10-01", 1),
  line("b", "2026-10-01", 2, "ignored", "-50.00"),
  line("d", "2026-10-05", 4),
  line("e", "2026-10-06", 5),
];

describe("matching queue", () => {
  it("orders by date then line number and names each state", () => {
    expect(queueOrder(LINES).map((l) => l.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(LINES.map(lineState)).toEqual(["matched", "unmatched", "ignored", "unmatched", "unmatched"]);
    expect(direction("-50.00")).toBe("out");
    expect(direction("50.00")).toBe("in");
  });
  it("counts progress from the API's statement counts", () => {
    expect(queueProgress({ lineCount: 24, matchedCount: 15, unmatchedCount: 6 })).toMatchObject({
      done: 18,
      ignored: 3,
      share: 0.75,
    });
    expect(queueProgress({ lineCount: 0, matchedCount: 0, unmatchedCount: 0 }).share).toBe(0);
  });
  it("moves to the next unmatched line after an action, wrapping to earlier ones", () => {
    expect(nextLineAfter(LINES, "a")?.id).toBe("d");
    expect(nextLineAfter(LINES, "d")?.id).toBe("e");
    expect(nextLineAfter(LINES, "e")?.id).toBe("a");
    expect(nextLineAfter([line("x", "2026-10-01", 1)], "x")).toBeNull();
  });
  it("selects the asked line, else the first unmatched", () => {
    expect(selectLine(LINES, "c")?.id).toBe("c");
    expect(selectLine(LINES, "zzz")?.id).toBe("a");
    expect(selectLine([], undefined)).toBeNull();
  });
  it("ranks a reference hit first, then the closest date; best only when clearly ahead", () => {
    const s = (id: string, days: number, referenceHit: boolean) => ({
      kind: "payment",
      id,
      label: id,
      days,
      referenceHit,
    });
    const ranked = rankSuggestions([s("far", 3, false), s("hit", 2, true), s("near", 0, false)]);
    expect(ranked.list.map((x) => x.id)).toEqual(["hit", "near", "far"]);
    expect(ranked.best?.id).toBe("hit");
    expect(rankSuggestions([s("a", 1, false), s("b", 0, false)]).best).toBeNull();
    expect(rankSuggestions([s("only", 2, false)]).best?.id).toBe("only");
    expect(rankSuggestions([]).best).toBeNull();
  });
});

describe("candidatePath (J-CR: link from kind + id)", () => {
  it("opens the record behind each candidate", () => {
    expect(candidatePath("payment", "p1")).toBe("/payments/p1");
    expect(candidatePath("expense", "e1")).toBe("/juristic/expenses/e1");
    expect(candidatePath("fund_transfer", "t1")).toBe("/juristic/funds/transfers/t1");
  });
});
