import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatIsoDate,
  formatBytes,
  formatPercent,
  formatPeriodKey,
  parsePeriodKey,
  formatPhone,
  formatDuration,
  formatRelativeTime,
  formatTHB,
  formatTime,
  formatUnits,
} from "./format";

describe("formatTHB", () => {
  it("formats the API's decimal string without arithmetic", () => {
    expect(formatTHB("1234.5")).toBe("฿1,234.50");
    expect(formatTHB("1234.567")).toBe("฿1,234.56");
    expect(formatTHB("0")).toBe("฿0.00");
    expect(formatTHB("-500.5")).toBe("-฿500.50");
    expect(formatTHB("99999999999999999999.01")).toBe("฿99,999,999,999,999,999,999.01");
  });
  it("never renders NaN", () => {
    expect(formatTHB("abc")).toBe("฿—");
    expect(formatTHB("")).toBe("฿—");
    expect(formatTHB("12,3")).toBe("฿—");
  });
  it("drops the symbol or the decimals on request", () => {
    expect(formatTHB("1500", "th", { withSymbol: false })).toBe("1,500.00");
    expect(formatTHB("1500", "en", { decimals: 0 })).toBe("฿1,500");
  });
});

describe("formatUnits", () => {
  it("trims trailing zeros to at most three decimals", () => {
    expect(formatUnits("123.456000", "kWh")).toBe("123.456 kWh");
    expect(formatUnits("12.5000", "m3")).toBe("12.5 m³");
    expect(formatUnits("1000", "kWh")).toBe("1,000 kWh");
    expect(formatUnits("0.0004", "m3")).toBe("0 m³");
    expect(formatUnits("7", "kWh", "th", { withUnit: false })).toBe("7");
  });
  it("never renders NaN", () => {
    expect(formatUnits("x", "kWh")).toBe("—");
  });
});

describe("formatBytes (D-276)", () => {
  it("uses binary units with one decimal, like the API's notices", () => {
    expect(formatBytes("1610612736", "en")).toBe("1.5 GB");
    expect(formatBytes("5368709120")).toBe("5 GB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes("2048", "en")).toBe("2 KB");
    expect(formatBytes("x")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("trims as text", () => {
    expect(formatPercent("12.5000")).toBe("12.5%");
    expect(formatPercent("8")).toBe("8%");
  });
});

describe("dates in Bangkok time", () => {
  // 2026-09-17T17:30Z is 2026-09-18 00:30 in Bangkok: the day must roll over.
  const late = "2026-09-17T17:30:00Z";

  it("renders the Buddhist era for Thai by default", () => {
    expect(formatDate("2026-09-17T03:00:00Z")).toBe("17 ก.ย. 2569");
    expect(formatDate(late)).toBe("18 ก.ย. 2569");
    expect(formatDate("2026-09-17T03:00:00Z", "th", { style: "long" })).toBe("17 กันยายน 2569");
    expect(formatDate("2026-09-17T03:00:00Z", "th", { style: "numeric" })).toBe("17/09/2569");
  });
  it("renders the Common Era for English, or on request", () => {
    expect(formatDate("2026-09-17T03:00:00Z", "en")).toBe("17 Sept 2026");
    expect(formatDate("2026-09-17T03:00:00Z", "th", { era: "ce" })).toBe("17 ก.ย. 2026");
  });
  it("adds the time and exports ISO", () => {
    expect(formatDateTime(late)).toBe("18 ก.ย. 2569 00:30");
    expect(formatIsoDate(late)).toBe("2026-09-18");
  });
  it("never renders Invalid Date", () => {
    expect(formatDate("nope")).toBe("—");
    expect(formatIsoDate("nope")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("is coarse and locale-aware", () => {
    expect(formatRelativeTime("2026-10-16T11:55:00Z", "en", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-10-16T11:55:00Z", "th", now)).toBe("5 นาทีที่ผ่านมา");
    expect(formatRelativeTime("2026-10-18T12:00:00Z", "en", now)).toBe("in 2 days");
    expect(formatRelativeTime("2026-10-16T12:00:10Z", "en", now)).toBe("now");
  });
});

describe("formatPhone", () => {
  it("groups Thai mobile and landline numbers", () => {
    expect(formatPhone("0812345678")).toBe("081-234-5678");
    expect(formatPhone("+66812345678")).toBe("081-234-5678");
    expect(formatPhone("021234567")).toBe("02-123-4567");
    expect(formatPhone("12")).toBe("12");
  });
});

describe("formatPeriodKey", () => {
  it("renders a cut-off month in the reader's calendar", () => {
    expect(formatPeriodKey("2026-10", "th")).toBe("ต.ค. 2569");
    expect(formatPeriodKey("2026-10", "en")).toBe("Oct 2026");
    expect(formatPeriodKey("not-a-key", "th")).toBe("not-a-key");
  });

  it("names quarters, halves and years in Thai with the Buddhist year (D-303)", () => {
    expect(formatPeriodKey("2027-Q1", "th")).toBe("ไตรมาส 1/2570");
    expect(formatPeriodKey("2026-Q4", "th")).toBe("ไตรมาส 4/2569");
    expect(formatPeriodKey("2027-H1", "th")).toBe("ครึ่งปีแรก 2570");
    expect(formatPeriodKey("2027-H2", "th")).toBe("ครึ่งปีหลัง 2570");
    expect(formatPeriodKey("2027", "th")).toBe("ปี 2570");
  });

  it("names them in English with the Gregorian year, or the era asked for", () => {
    expect(formatPeriodKey("2027-Q3", "en")).toBe("Q3 2027");
    expect(formatPeriodKey("2027-H2", "en")).toBe("Second half 2027");
    expect(formatPeriodKey("2027", "en")).toBe("Year 2027");
    expect(formatPeriodKey("2027-Q1", "th", { era: "ce" })).toBe("ไตรมาส 1/2027");
  });

  it("leaves what is not a period key as it is", () => {
    expect(formatPeriodKey("2027-Q5", "th")).toBe("2027-Q5");
    expect(formatPeriodKey("2027-H3", "en")).toBe("2027-H3");
    expect(formatPeriodKey("2027-13", "th")).toBe("2027-13");
  });
});

describe("formatTime", () => {
  it("shows the Bangkok time of day", () => {
    expect(formatTime("2026-10-21T11:00:00Z", "en")).toBe("18:00");
    expect(formatTime("not a date")).toBe("—");
  });
});

describe("formatDuration", () => {
  it("names a span in its largest whole unit", () => {
    expect(formatDuration(45 * 60_000, "en")).toBe("45 mins");
    expect(formatDuration(-6 * 3_600_000, "th")).toBe("6 ชม.");
    expect(formatDuration(3 * 86_400_000, "th")).toBe("3 วัน");
    expect(formatDuration(10_000, "en")).toBe("1 min");
    expect(formatDuration(3_590_000, "th")).toBe("1 ชม.");
  });
});

describe("parsePeriodKey", () => {
  it("reads the frequency, year and position of a key", () => {
    expect(parsePeriodKey("2026-10")).toEqual({ frequency: "monthly", year: 2026, index: 10 });
    expect(parsePeriodKey("2027-Q2")).toEqual({ frequency: "quarterly", year: 2027, index: 2 });
    expect(parsePeriodKey("2027-H1")).toEqual({ frequency: "semiannual", year: 2027, index: 1 });
    expect(parsePeriodKey("2027")).toEqual({ frequency: "annual", year: 2027, index: 1 });
    expect(parsePeriodKey("2027-00")).toBeNull();
    expect(parsePeriodKey("27-Q1")).toBeNull();
  });
});
