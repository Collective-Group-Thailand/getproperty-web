import type { CookieSpec } from "./cookies";
import { ACCESS_EXPIRY_SKEW_SECONDS } from "./cookies";

/**
 * The gate tablet's cookies (JW4, D-320) on the owner host, beside — never instead of — an operator's session:
 *
 * - `__Host-gp_gdev`: the enrolled device (`<deviceId>.<deviceSecret>`, the secret the API returned once at
 *   enrolment). It only ever travels to this app's server, which sends it to the API for the roster and the PIN
 *   sign-in; JavaScript in the page cannot read it (ADR-0004: no credential in browser storage).
 * - `__Host-gp_gat` / `__Host-gp_grt`: the guard's token pair (audience `guard`) of the open shift.
 * - `__Host-gp_glock`: the desk is locked to the PIN pad (review W1). The server renders the lock screen while it is
 *   there and the BFF refuses the desk's writes; only a PIN sign-in, sign-out or forgetting the tablet lifts it. The
 *   shift's tokens stay, so the lists, the stream and the SOS banner keep running behind the lock.
 *
 * Same flags as every session cookie (`cookies.ts`): host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`.
 */
export const GUARD_DEVICE_COOKIE = "__Host-gp_gdev";
export const GUARD_ACCESS_COOKIE = "__Host-gp_gat";
export const GUARD_REFRESH_COOKIE = "__Host-gp_grt";
export const GUARD_LOCK_COOKIE = "__Host-gp_glock";

/** Longer than any guard refresh family (14 h): the lock outlives the shift it locks. */
const LOCK_MAX_AGE = 24 * 60 * 60;

/** Browsers cap a cookie's life at 400 days; the API revokes a device, not the cookie's age. */
const DEVICE_MAX_AGE = 400 * 24 * 60 * 60;

const base = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GuardDevice {
  deviceId: string;
  deviceSecret: string;
}

export function deviceCookie(device: GuardDevice): CookieSpec {
  return {
    name: GUARD_DEVICE_COOKIE,
    value: `${device.deviceId}.${device.deviceSecret}`,
    options: { ...base, maxAge: DEVICE_MAX_AGE },
  };
}

/** The device in the cookie, or `null` when there is none or it is malformed (never sent upstream then). */
export function readDevice(value: string | undefined): GuardDevice | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const deviceId = value.slice(0, dot);
  const deviceSecret = value.slice(dot + 1);
  if (!UUID.test(deviceId) || deviceSecret.length < 16 || deviceSecret.length > 512) return null;
  return { deviceId: deviceId.toLowerCase(), deviceSecret };
}

function secondsUntil(iso: string, now: number): number {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.floor((at - now) / 1000) : 0;
}

export function guardSessionCookies(
  pair: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string },
  now = Date.now(),
): CookieSpec[] {
  return [
    {
      name: GUARD_ACCESS_COOKIE,
      value: pair.accessToken,
      options: {
        ...base,
        maxAge: Math.max(1, secondsUntil(pair.accessTokenExpiresAt, now) - ACCESS_EXPIRY_SKEW_SECONDS),
      },
    },
    {
      name: GUARD_REFRESH_COOKIE,
      value: pair.refreshToken,
      options: { ...base, maxAge: Math.max(1, secondsUntil(pair.refreshTokenExpiresAt, now)) },
    },
  ];
}

export function lockCookie(): CookieSpec {
  return { name: GUARD_LOCK_COOKIE, value: "1", options: { ...base, maxAge: LOCK_MAX_AGE } };
}

export function clearedLockCookie(): CookieSpec {
  return { name: GUARD_LOCK_COOKIE, value: "", options: { ...base, maxAge: 0 } };
}

/** Ending the session (sign-out, refused refresh, device gone) lifts the lock too: the roster is next anyway. */
export function clearedGuardCookies(options: { device?: boolean } = {}): CookieSpec[] {
  const names = options.device
    ? [GUARD_ACCESS_COOKIE, GUARD_REFRESH_COOKIE, GUARD_LOCK_COOKIE, GUARD_DEVICE_COOKIE]
    : [GUARD_ACCESS_COOKIE, GUARD_REFRESH_COOKIE, GUARD_LOCK_COOKIE];
  return names.map((name) => ({ name, value: "", options: { ...base, maxAge: 0 } }));
}
