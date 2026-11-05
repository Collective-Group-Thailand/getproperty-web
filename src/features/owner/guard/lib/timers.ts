/**
 * Live timers of the gate lists (JW4). Every figure comes from timestamps the API returned (`createdAt`, `respondBy`,
 * `enteredAt`) and the tablet's clock; nothing here decides a policy — the API's `gate-visits` job moves a visit to
 * `timed_out` and applies the house policy (D-327). The progress line only shows how far the house's answer window
 * has run.
 */

export interface PolicyProgress {
  /** 0–1 of the answer window used (1 once `respondBy` has passed). */
  fraction: number;
  /** Milliseconds until `respondBy` (0 when passed). */
  remainingMs: number;
  /** The window has passed on this tablet's clock (the API's job confirms within seconds). */
  elapsed: boolean;
}

export function policyProgress(createdAt: string, respondBy: string | null, now: number): PolicyProgress | null {
  if (!respondBy) return null;
  const start = Date.parse(createdAt);
  const end = Date.parse(respondBy);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const used = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const remainingMs = Math.max(0, end - now);
  return { fraction: used, remainingMs, elapsed: remainingMs === 0 };
}

/** Milliseconds since an ISO time (never negative: a clock a little behind the server's reads 0). */
export function sinceMs(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.max(0, now - at) : 0;
}

/** `1:07`, `12:30`, `1:02:03` — a stopwatch reading, tabular in the UI. */
export function formatStopwatch(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/** Whole minutes and hours for "51 นาทีที่แล้ว" / "4 ชม." lines. */
export function durationParts(ms: number): { hours: number; minutes: number } {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** `HH:mm` in Bangkok time (the gate's clock and every stamp on the tablet). */
export function bangkokTime(iso: string | number | Date, withSeconds = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).format(date);
}

/** Whether a shift-long session has seen no touch for `idleMs` (auto lock, JW4). */
export function isIdle(lastActivity: number, now: number, idleMs: number): boolean {
  return now - lastActivity >= idleMs;
}

/** Seconds left of a PIN lockout (`lockedUntil` from the API's 423), 0 once it has passed. */
export function lockoutSecondsLeft(lockedUntil: string | null | undefined, now: number): number {
  if (!lockedUntil) return 0;
  const until = Date.parse(lockedUntil);
  return Number.isFinite(until) ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}
