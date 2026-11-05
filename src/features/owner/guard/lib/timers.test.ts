import { describe, expect, it } from "vitest";

import { INITIAL_PIN, canSubmit, isLocked, pinReducer, type PinState } from "./pin";
import {
  bangkokTime,
  durationParts,
  formatStopwatch,
  isIdle,
  lockoutSecondsLeft,
  policyProgress,
  sinceMs,
} from "./timers";

const T0 = Date.parse("2026-11-05T15:00:00Z");

describe("policyProgress", () => {
  it("runs from created to respondBy", () => {
    const created = new Date(T0).toISOString();
    const respondBy = new Date(T0 + 180_000).toISOString();
    expect(policyProgress(created, respondBy, T0 + 72_000)).toEqual({
      fraction: 0.4,
      remainingMs: 108_000,
      elapsed: false,
    });
    expect(policyProgress(created, respondBy, T0 + 200_000)).toEqual({ fraction: 1, remainingMs: 0, elapsed: true });
    expect(policyProgress(created, respondBy, T0 - 5_000)?.fraction).toBe(0);
  });
  it("has no line without a window", () => {
    expect(policyProgress(new Date(T0).toISOString(), null, T0)).toBeNull();
    expect(policyProgress(new Date(T0).toISOString(), new Date(T0).toISOString(), T0)).toBeNull();
  });
});

describe("stopwatch and durations", () => {
  it("formats like a stopwatch", () => {
    expect(formatStopwatch(72_000)).toBe("1:12");
    expect(formatStopwatch(3_723_000)).toBe("1:02:03");
    expect(formatStopwatch(-5)).toBe("0:00");
  });
  it("never counts backwards", () => {
    expect(sinceMs(new Date(T0 + 1000).toISOString(), T0)).toBe(0);
    expect(sinceMs(null, T0)).toBe(0);
    expect(durationParts(3 * 3600_000 + 51 * 60_000)).toEqual({ hours: 3, minutes: 51 });
  });
  it("reads the clock in Bangkok", () => {
    expect(bangkokTime("2026-11-05T15:41:09Z")).toBe("22:41");
    expect(bangkokTime("2026-11-05T15:41:09Z", true)).toBe("22:41:09");
  });
  it("is idle after the threshold", () => {
    expect(isIdle(T0, T0 + 299_999, 300_000)).toBe(false);
    expect(isIdle(T0, T0 + 300_000, 300_000)).toBe(true);
  });
});

describe("PIN pad", () => {
  const type = (state: PinState, digits: string) =>
    [...digits].reduce((s, value) => pinReducer(s, { type: "digit", value }), state);

  it("takes 4–6 digits and submits only then", () => {
    let state = type(INITIAL_PIN, "123");
    expect(canSubmit(state)).toBe(false);
    state = type(state, "4567");
    expect(state.digits).toBe("123456");
    expect(canSubmit(state)).toBe(true);
    state = pinReducer(state, { type: "submit" });
    expect(state.submitting).toBe(true);
    expect(type(state, "9").digits).toBe("123456");
  });
  it("clears the digits on a wrong PIN and shows why", () => {
    const state = pinReducer(pinReducer(type(INITIAL_PIN, "1234"), { type: "submit" }), {
      type: "refused",
      error: "invalid",
    });
    expect(state).toMatchObject({ digits: "", error: "invalid", submitting: false, lockedUntil: null });
  });
  it("stays closed until lockedUntil from the API's 423", () => {
    const until = new Date(T0 + 15 * 60_000).toISOString();
    let state = pinReducer(type(INITIAL_PIN, "1234"), { type: "refused", error: "locked", lockedUntil: until });
    expect(isLocked(state, T0)).toBe(true);
    expect(lockoutSecondsLeft(until, T0)).toBe(900);
    expect(type(state, "1").digits).toBe("");
    expect(pinReducer(state, { type: "submit" }).submitting).toBe(false);
    expect(isLocked(state, T0 + 15 * 60_000)).toBe(false);
    state = pinReducer(state, { type: "unlockedByTime" });
    expect(type(state, "1").digits).toBe("1");
  });
});
