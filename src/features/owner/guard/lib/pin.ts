import { lockoutSecondsLeft } from "./timers";

/**
 * The PIN pad of the gate tablet (JW4, D-320): 4–6 digits, checked only by the API (`POST /v1/auth/guard/sign-in`).
 * Wrong PINs are counted there; after `gate.pin_max_attempts` the API answers 423 `gate.pin_locked` with `lockedUntil`
 * and the pad stays closed until then (the roster also marks a locked guard). Nothing is counted on the tablet.
 */
export const PIN_MIN = 4;
export const PIN_MAX = 6;

export type PinError = "invalid" | "locked" | "unavailable" | null;

export interface PinState {
  digits: string;
  error: PinError;
  lockedUntil: string | null;
  submitting: boolean;
}

export const INITIAL_PIN: PinState = { digits: "", error: null, lockedUntil: null, submitting: false };

export type PinAction =
  | { type: "digit"; value: string }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "submit" }
  | { type: "refused"; error: Exclude<PinError, null>; lockedUntil?: string | null }
  | { type: "unlockedByTime" };

export function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case "digit":
      if (state.submitting || state.lockedUntil || !/^\d$/.test(action.value) || state.digits.length >= PIN_MAX) {
        return state;
      }
      return { ...state, digits: state.digits + action.value, error: state.error === "locked" ? state.error : null };
    case "backspace":
      return state.submitting ? state : { ...state, digits: state.digits.slice(0, -1) };
    case "clear":
      return state.submitting ? state : { ...state, digits: "" };
    case "submit":
      return canSubmit(state) ? { ...state, submitting: true, error: null } : state;
    case "refused":
      return {
        digits: "",
        submitting: false,
        error: action.error,
        lockedUntil: action.error === "locked" ? (action.lockedUntil ?? null) : null,
      };
    case "unlockedByTime":
      return { ...state, lockedUntil: null, error: null };
  }
}

export function canSubmit(state: PinState): boolean {
  return !state.submitting && !state.lockedUntil && state.digits.length >= PIN_MIN && state.digits.length <= PIN_MAX;
}

/** Whether the pad is closed right now (a lockout still running on this clock). */
export function isLocked(state: PinState, now: number): boolean {
  return lockoutSecondsLeft(state.lockedUntil, now) > 0;
}
