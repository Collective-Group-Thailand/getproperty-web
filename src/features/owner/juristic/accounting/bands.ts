import { decimalSatang } from "./money";

/**
 * Expense approval bands (D-311, D-329; setting `juristic.approval_bands`): ascending inclusive `upTo` limits (the
 * last `null`) → the roles that may approve and how many distinct approvals are needed. The API snapshots the band at
 * submission and decides every approval; this file explains it in words and says why the viewer cannot approve.
 */
export const BAND_ROLES = ["owner", "manager", "committee"] as const;
export type BandRole = (typeof BAND_ROLES)[number];

export interface ApprovalBand {
  upTo: string | null;
  roles: BandRole[];
  approvals: number;
}

const isRole = (value: unknown): value is BandRole => BAND_ROLES.includes(value as BandRole);

/** The setting's value as bands, defensively (an unexpected value → no bands, the editor shows the API's problem). */
export function parseBands(value: unknown): ApprovalBand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ApprovalBand[] => {
    if (!entry || typeof entry !== "object") return [];
    const band = entry as Record<string, unknown>;
    const upTo = typeof band.upTo === "string" ? band.upTo : null;
    const roles = Array.isArray(band.roles) ? band.roles.filter(isRole) : [];
    const approvals = Number.isInteger(band.approvals) ? (band.approvals as number) : 1;
    return [{ upTo, roles, approvals }];
  });
}

/** The band an amount (the API's decimal string) falls in: the first whose `upTo` it does not pass. */
export function bandIndexFor(amount: string, bands: readonly ApprovalBand[]): number {
  const value = decimalSatang(amount);
  if (value === null || bands.length === 0) return -1;
  const index = bands.findIndex((band) => {
    if (band.upTo === null) return true;
    const limit = decimalSatang(band.upTo);
    return limit !== null && value <= limit;
  });
  return index === -1 ? bands.length - 1 : index;
}

/** How a band reads: "up to ฿10,000", "฿10,000.01 – ฿100,000" or "above ฿100,000" — the limits only, no maths. */
export type BandRange =
  | { kind: "upTo"; upTo: string }
  | { kind: "between"; above: string; upTo: string }
  | { kind: "above"; above: string }
  | { kind: "any" };

export function bandRange(bands: readonly Pick<ApprovalBand, "upTo">[], index: number): BandRange {
  const band = bands[index];
  const previous = index > 0 ? bands[index - 1]?.upTo : null;
  if (!band) return { kind: "any" };
  if (band.upTo === null) return previous ? { kind: "above", above: previous } : { kind: "any" };
  return previous ? { kind: "between", above: previous, upTo: band.upTo } : { kind: "upTo", upTo: band.upTo };
}

/** A request's band as the record states it (`band.upTo` is the snapshot; the lower bound is unknown there). */
export function snapshotRange(band: { upTo: string | null; key: string }): BandRange {
  if (band.upTo !== null) return { kind: "upTo", upTo: band.upTo };
  const above = /^gt:(.+)$/.exec(band.key)?.[1];
  return above ? { kind: "above", above } : { kind: "any" };
}

export interface ApprovalProgress {
  given: number;
  required: number;
  /** 0–1 for the progress line (drawing only). */
  share: number;
  complete: boolean;
}

export function approvalProgress(request: {
  approvalsGiven: number;
  approvalsRequired: number | null;
  band: { approvals: number } | null;
}): ApprovalProgress {
  const required = request.approvalsRequired ?? request.band?.approvals ?? 0;
  const given = request.approvalsGiven;
  return {
    given,
    required,
    share: required > 0 ? Math.min(1, given / required) : 0,
    complete: required > 0 && given >= required,
  };
}

/**
 * Why the viewer cannot approve a request the API did not offer them (`nextActions` without `approve`), in the order
 * the API checks: not waiting, the viewer drafted it (maker ≠ checker, D-091), already decided, role outside the band,
 * no permission. `null` when they can approve.
 */
export type ApproveBlock = "state" | "requester" | "decided" | "role" | "permission";

export function approveBlock(
  request: {
    state: string;
    requestedBy: string;
    nextActions: readonly string[];
    approvals: readonly { approverUserId: string }[];
    band: { roles: readonly string[] } | null;
  },
  viewer: { userId: string; roles: readonly string[]; canApprove: boolean },
): ApproveBlock | null {
  if (request.nextActions.includes("approve")) return null;
  if (request.state !== "submitted") return "state";
  if (request.requestedBy === viewer.userId) return "requester";
  if (request.approvals.some((approval) => approval.approverUserId === viewer.userId)) return "decided";
  if (request.band && !viewer.roles.some((role) => request.band!.roles.includes(role))) return "role";
  return viewer.canApprove ? "role" : "permission";
}

export type BandProblem = "upTo" | "order" | "roles" | "approvals" | "last" | "count";

/** Checks edited bands before sending (the API checks again): 1–10 bands, ascending limits, the last open-ended. */
export function checkBands(bands: readonly { upTo: string; roles: readonly string[]; approvals: number }[]): {
  rows: BandProblem[][];
  problems: BandProblem[];
  ok: boolean;
} {
  const problems: BandProblem[] = [];
  if (bands.length < 1 || bands.length > 10) problems.push("count");
  let previous: bigint | null = null;
  const rows = bands.map((band, index) => {
    const out: BandProblem[] = [];
    const last = index === bands.length - 1;
    if (!last) {
      const limit = decimalSatang(band.upTo.trim().replace(/,/g, ""));
      if (limit === null || limit <= 0n) out.push("upTo");
      else if (previous !== null && limit <= previous) out.push("order");
      else previous = limit;
    }
    if (band.roles.length === 0) out.push("roles");
    if (!Number.isInteger(band.approvals) || band.approvals < 1 || band.approvals > 5) out.push("approvals");
    return out;
  });
  return { rows, problems, ok: problems.length === 0 && rows.every((row) => row.length === 0) };
}
