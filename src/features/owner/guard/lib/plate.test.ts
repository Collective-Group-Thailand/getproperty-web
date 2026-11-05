import { describe, expect, it } from "vitest";

import {
  CONSONANT_GROUPS,
  EMPTY_PLATE,
  formatPlate,
  keypadReducer,
  normaliseChars,
  normalisePlate,
  plateProblems,
  type KeypadState,
} from "./plate";
import { orderedProvinces, PROVINCES, readRecentProvinces, rememberProvince, RECENT_PROVINCES_MAX } from "./provinces";

const start: KeypadState = { plate: EMPTY_PLATE, field: "category" };
const press = (state: KeypadState, ...keys: string[]) =>
  keys.reduce((s, value) => keypadReducer(s, value === "⌫" ? { type: "backspace" } : { type: "key", value }), state);

describe("consonant groups", () => {
  it("offers the 42 consonants used on plates once each, without the obsolete ฃ and ฅ", () => {
    const letters = CONSONANT_GROUPS.flatMap((group) => [...group.letters]);
    expect(letters).toHaveLength(42);
    expect(new Set(letters).size).toBe(42);
    expect(letters).not.toContain("ฃ");
    expect(letters).not.toContain("ฅ");
    expect(CONSONANT_GROUPS.map((group) => group.key)).toEqual(["mid", "high", "lowPaired", "lowSingle"]);
  });
});

describe("normalise", () => {
  it("turns Thai digits into Arabic and drops separators", () => {
    expect(normaliseChars("๑กข-๒")).toBe("1กข2");
    expect(normalisePlate({ category: " ๓ กท ", number: "88-12", province: " กรุงเทพมหานคร " })).toEqual({
      category: "3กท",
      number: "8812",
      province: "กรุงเทพมหานคร",
    });
  });
  it("caps the category and the number at four characters", () => {
    expect(normalisePlate({ category: "1กขคง", number: "123456", province: "" })).toMatchObject({
      category: "1กขค",
      number: "1234",
    });
  });
});

describe("keypad", () => {
  it("types the category, then digits after a full category go to the number", () => {
    const state = press(start, "1", "ก", "ข", "ค", "4", "5");
    expect(state.plate).toMatchObject({ category: "1กขค", number: "45" });
    expect(state.field).toBe("number");
  });
  it("a letter typed on the number belongs to the category", () => {
    const state = press({ plate: { ...EMPTY_PLATE, category: "1ก" }, field: "number" }, "ข");
    expect(state.plate.category).toBe("1กข");
    expect(state.field).toBe("category");
  });
  it("backspace on an empty number steps back into the category", () => {
    const state = press({ plate: { ...EMPTY_PLATE, category: "กข", number: "1" }, field: "number" }, "⌫", "⌫");
    expect(state.plate).toMatchObject({ category: "ก", number: "" });
    expect(state.field).toBe("category");
  });
  it("ignores a fifth digit and keys that are not plate characters", () => {
    const state = press({ plate: { ...EMPTY_PLATE, category: "กข", number: "1234" }, field: "number" }, "5", "x");
    expect(state.plate.number).toBe("1234");
  });
  it("sets and clears the province, and clear empties everything", () => {
    let state = keypadReducer(start, { type: "province", value: "ชลบุรี" });
    expect(state.plate.province).toBe("ชลบุรี");
    state = keypadReducer(state, { type: "backspace" });
    expect(state.plate.province).toBe("");
    expect(keypadReducer(press(start, "ก"), { type: "clear" })).toEqual(start);
  });
});

describe("plateProblems", () => {
  it("accepts an empty plate (walk-in) and a complete one", () => {
    expect(plateProblems(EMPTY_PLATE)).toEqual({});
    expect(plateProblems({ category: "1กข", number: "4521", province: "กรุงเทพมหานคร" })).toEqual({});
    expect(plateProblems({ category: "กข", number: "1", province: "ชลบุรี" })).toEqual({});
  });
  it("names each missing or wrong part of a started plate", () => {
    expect(plateProblems({ category: "12", number: "", province: "" })).toEqual({
      category: "categoryInvalid",
      number: "numberInvalid",
      province: "provinceMissing",
    });
  });
  it("formats plates as they are read", () => {
    expect(formatPlate({ category: "3กท", number: "8812" })).toBe("3กท 8812");
    expect(formatPlate(null)).toBe("");
  });
});

describe("provinces", () => {
  it("lists the 77 provinces once", () => {
    expect(PROVINCES).toHaveLength(77);
    expect(new Set(PROVINCES).size).toBe(77);
  });
  it("keeps recent provinces first, unique and short", () => {
    let recent: string[] = [];
    for (const p of ["ชลบุรี", "กรุงเทพมหานคร", "ชลบุรี", "ระยอง", "ตาก", "น่าน", "เลย", "ยะลา", "บึงกาฬ"]) {
      recent = rememberProvince(recent, p);
    }
    expect(recent[0]).toBe("บึงกาฬ");
    expect(recent).toHaveLength(RECENT_PROVINCES_MAX);
    expect(rememberProvince(recent, "Atlantis")).toEqual(recent);
    const ordered = orderedProvinces(["ระยอง", "ชลบุรี"]);
    expect(ordered.recent).toEqual(["ระยอง", "ชลบุรี"]);
    expect(ordered.rest).not.toContain("ระยอง");
    expect(ordered.rest).toHaveLength(75);
    expect(orderedProvinces([], "นคร").rest).toContain("นครปฐม");
  });
  it("reads a broken stored list as empty", () => {
    expect(readRecentProvinces({ getItem: () => "{oops" })).toEqual([]);
    expect(readRecentProvinces({ getItem: () => '["ตาก", 3]' })).toEqual(["ตาก"]);
  });
});

describe("destination units", async () => {
  const { filterUnits, groupsOf, readCachedUnits, writeCachedUnits } = await import("./units");
  const unit = (unitNo: string, buildingName: string) => ({
    unitId: unitNo,
    unitNo,
    buildingId: buildingName,
    buildingName,
    lineLinked: true,
    policy: {
      action: "guard_calls" as const,
      custom: false,
      deliverySkipApproval: null,
      householdNote: "dog",
      timeoutSeconds: 180,
    },
  });
  const units = [unit("99/11", "ซอย 1"), unit("99/12", "ซอย 1"), unit("99/21", "ซอย 2")];
  it("filters by number (Thai digits, spaces) and soi", () => {
    expect(filterUnits(units, "๙๙/๒", null).map((u) => u.unitNo)).toEqual(["99/21"]);
    expect(filterUnits(units, " 99/1 ", "ซอย 1")).toHaveLength(2);
    expect(filterUnits(units, "", "ซอย 2")).toHaveLength(1);
    expect(groupsOf(units)).toEqual(["ซอย 1", "ซอย 2"]);
  });
  it("remembers the list per gate without the household note", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    writeCachedUnits("g1", units, storage);
    expect(store.get("gp.gate.units")).not.toContain("dog");
    expect(readCachedUnits("g1", storage)).toHaveLength(3);
    expect(readCachedUnits("g2", storage)).toEqual([]);
  });
});
