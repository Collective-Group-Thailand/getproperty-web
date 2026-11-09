import type { Schemas } from "@/lib/api/types";
import { isZeroDecimal } from "@/ui/lib/decimal";

/*
 * The developer handover inbox (pack J, JW3b; api J3.2, D-333) — pure rules, unit-tested: what blocks an acceptance
 * (shown before the API refuses), the problems per unit, the unit table's filters, the inbox tabs and the refusals in
 * the office's words. The API decides on submit; these lines only explain.
 */

type Review = Schemas["JuristicHandoverReviewDto"];
type Unit = Schemas["HandoverUnitDto"];
export type HandoverState = Schemas["HandoverState"];

/** Inbox tabs: the work first (waiting for review), then what was decided, then everything. */
export const INBOX_TABS = ["pending", "accepted", "rejected", "all"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export const TAB_STATE: Readonly<Record<InboxTab, HandoverState | undefined>> = {
  pending: "pending_review",
  accepted: "accepted",
  rejected: "rejected",
  all: undefined,
};

/** `?tab=` when valid; else the waiting tab when it has handovers, else all. */
export function inboxTab(value: string | undefined, pendingCount: number): InboxTab {
  if (value && (INBOX_TABS as readonly string[]).includes(value)) return value as InboxTab;
  return pendingCount > 0 ? "pending" : "all";
}

/** Why "accept" is not ready yet, in the order the API checks: the handover date, then the problems. */
export type AcceptBlock = { reason: "not_due"; on: string } | { reason: "problems"; count: number } | null;

export function acceptBlock(review: Pick<Review, "requestedHandoverAt" | "problems">, now: number): AcceptBlock {
  if (Date.parse(review.requestedHandoverAt) > now) return { reason: "not_due", on: review.requestedHandoverAt };
  if (review.problems.length > 0) return { reason: "problems", count: review.problems.length };
  return null;
}

/** Whether the handover date is still ahead (a calm badge on the inbox row). */
export function notDue(requestedHandoverAt: string, now: number): boolean {
  return Date.parse(requestedHandoverAt) > now;
}

/** The problems of each unit (`unitRef` → codes), for the unit table and its filter. */
export function problemsByUnit(problems: readonly Schemas["HandoverProblemDto"][]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const problem of problems) {
    if (!problem.unitRef) continue;
    out.set(problem.unitRef, [...(out.get(problem.unitRef) ?? []), problem.code]);
  }
  return out;
}

/** The unit number a problem names (the payload's `unitRef` is never shown). */
export function unitNoOf(units: readonly Unit[], unitRef: string | null): string | null {
  if (!unitRef) return null;
  return units.find((unit) => unit.unitRef === unitRef)?.unitNo ?? null;
}

export const UNIT_FILTERS = ["all", "owed", "problems"] as const;
export type UnitFilter = (typeof UNIT_FILTERS)[number];

export function unitFilter(value: string | undefined, hasProblems: boolean): UnitFilter {
  if (value && (UNIT_FILTERS as readonly string[]).includes(value)) return value as UnitFilter;
  return hasProblems ? "problems" : "all";
}

/** The units of a filter: with money brought forward (not zero), with a problem, or all — the payload's order. */
export function filterUnits(units: readonly Unit[], problems: Map<string, string[]>, filter: UnitFilter): Unit[] {
  switch (filter) {
    case "owed":
      return units.filter((unit) => !isZeroDecimal(unit.receivablesBroughtForward));
    case "problems":
      return units.filter((unit) => problems.has(unit.unitRef));
    default:
      return [...units];
  }
}

/** What an acceptance recorded equals the payload (the API's invariant, D-333 (4)): compared as the API's strings. */
export function appliedMatches(review: Pick<Review, "applied" | "totals">): boolean {
  const applied = review.applied;
  if (!applied) return false;
  return (
    applied.credits === review.totals.advanceCommonFees &&
    applied.fundContributions === review.totals.firstFundContributions &&
    applied.openingInvoicesTotal === review.totals.receivablesBroughtForward
  );
}

/** A register-only payload (contract version 1): no money arrives with it. */
export function registerOnly(review: Pick<Review, "contractVersion">): boolean {
  return review.contractVersion < 2;
}

/** What the office does next after a refusal. */
export type HandoverNext = "reload" | "developer" | "register" | "legal_form" | null;

const PROBLEMS: Readonly<Record<string, { key: string; next: HandoverNext }>> = {
  "handover.not_due": { key: "notDue", next: null },
  "handover.unit_owned": { key: "unitOwned", next: "register" },
  "handover.totals_mismatch": { key: "totalsMismatch", next: "developer" },
  "handover.invalid": { key: "invalid", next: "developer" },
  "handover.invalid_state": { key: "invalidState", next: "reload" },
  "register.shares_exceeded": { key: "sharesExceeded", next: "developer" },
};

/** A refusal of a handover action in the office's words with its next step; `null` → the API's own notice. */
export function handoverProblem(code: string | null | undefined): { key: string; next: HandoverNext } | null {
  return code ? (PROBLEMS[code] ?? null) : null;
}

/** Reject / decline reasons: 5–1000 characters after trimming (the API's `JuristicImportRollbackDto`). */
export const REASON_MIN = 5;
export const REASON_MAX = 1000;
export function reasonOk(reason: string): boolean {
  const length = reason.trim().length;
  return length >= REASON_MIN && length <= REASON_MAX;
}
