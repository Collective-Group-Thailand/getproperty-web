import { describe, expect, it } from "vitest";

import {
  defaultEvaluationMonth,
  monthsToEvaluate,
  parseCriteria,
  shiftMonth,
  termMonths,
  trendPoints,
} from "./evaluations";
import { taxIdProblem } from "./taxId";

describe("evaluation trend", () => {
  const label = (month: string) => `m${month.slice(5)}`;

  it("draws one point per month oldest first, a missing month as a gap", () => {
    const points = trendPoints(
      [
        { month: "2026-08", score: "3.25" },
        { month: "2026-06", score: "4.50" },
        { month: "2026-05", score: "4.75" },
      ],
      label,
    );
    expect(points).toEqual([
      { key: "2026-05", label: "m05", value: "4.75" },
      { key: "2026-06", label: "m06", value: "4.50" },
      { key: "2026-07", label: "m07", value: null },
      { key: "2026-08", label: "m08", value: "3.25" },
    ]);
  });

  it("keeps the last twelve months and draws nothing without evaluations", () => {
    const many = Array.from({ length: 18 }, (_, index) => ({ month: shiftMonth("2025-01", index), score: "4.00" }));
    const points = trendPoints(many, label);
    expect(points).toHaveLength(12);
    expect(points[0]!.key).toBe("2025-07");
    expect(trendPoints([], label)).toEqual([]);
  });

  it("lists the months of the term still to evaluate, newest first, never the future", () => {
    expect(termMonths("2026-07-15", "2027-07-14", "2026-11")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(
      monthsToEvaluate(
        { startsOn: "2026-07-15", endsOn: "2027-07-14" },
        [{ month: "2026-07" }, { month: "2026-09" }],
        "2026-11",
      ),
    ).toEqual(["2026-11", "2026-10", "2026-08"]);
    expect(monthsToEvaluate({ startsOn: "2025-01-01", endsOn: "2025-03-31" }, [], "2026-11")).toEqual([
      "2025-03",
      "2025-02",
      "2025-01",
    ]);
  });

  it("opens on the last finished month, the current one only when nothing else is left", () => {
    expect(defaultEvaluationMonth(["2026-11", "2026-10", "2026-08"], "2026-11")).toBe("2026-10");
    expect(defaultEvaluationMonth(["2026-11"], "2026-11")).toBe("2026-11");
    expect(defaultEvaluationMonth([], "2026-11")).toBeNull();
  });

  it("crosses the year in month arithmetic", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -2)).toBe("2026-11");
  });

  it("reads the criteria setting defensively", () => {
    expect(parseCriteria([{ key: "quality", labelTh: "คุณภาพงาน", labelEn: "Quality" }, { nokey: 1 }, "x"])).toEqual([
      { key: "quality", labelTh: "คุณภาพงาน", labelEn: "Quality" },
    ]);
    expect(parseCriteria([{ key: "safety" }])).toEqual([{ key: "safety", labelTh: "safety", labelEn: "safety" }]);
    expect(parseCriteria(null)).toEqual([]);
  });
});

describe("tax id", () => {
  it("accepts 13 digits with a valid check digit, separators allowed", () => {
    expect(taxIdProblem("0105563012343")).toBeNull();
    expect(taxIdProblem("0-1055-63012-34-3")).toBeNull();
    expect(taxIdProblem("")).toBeNull();
  });

  it("refuses a wrong length or check digit", () => {
    expect(taxIdProblem("010556301234")).toBe("length");
    expect(taxIdProblem("0105563012345")).toBe("checksum");
  });
});
