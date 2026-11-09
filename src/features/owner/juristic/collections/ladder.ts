import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";

export type LadderStep = Schemas["CollectionStepDto"];
export type CollectionChannel = Schemas["CollectionChannel"];

export const CHANNELS: readonly CollectionChannel[] = ["line", "email", "sms", "letter"];
/** Suspension, a lawyer's letter and legal action always wait for a committee decision (J1.2b §1): the API refuses otherwise. */
export const APPROVAL_FORCED: ReadonlySet<Schemas["CollectionAction"]> = new Set([
  "suspend_services",
  "lawyer_letter",
  "legal_action",
]);
export const MAX_OFFSET = 3650;

/** What the editor holds for one step while it is being changed (the offset as typed). */
export interface StepDraft {
  offsetDays: string;
  channels: CollectionChannel[];
  requiresApproval: boolean;
  enabled: boolean;
}

export function draftOf(step: LadderStep): StepDraft {
  return {
    offsetDays: String(step.offsetDays),
    channels: [...step.channels],
    requiresApproval: step.requiresApproval,
    enabled: step.enabled,
  };
}

/**
 * The locks of a step (O-038): a legal measure counsel has not confirmed shows the lock and "ต้องให้ทนายยืนยันก่อนเปิดใช้"
 * while it is off; switching it on is refused in the editor while the API names a closed gate (`gateClosedReason`) —
 * the API refuses the same (422). Approval cannot be dropped for the three forced measures.
 */
export function stepLocks(step: LadderStep) {
  const legalLock = step.legalReviewRequired && !step.enabled;
  return {
    legalLock,
    gateReason: step.gateClosedReason,
    enableLocked: !step.enabled && step.gateClosedReason !== null,
    approvalLocked: APPROVAL_FORCED.has(step.action),
  };
}

export type OffsetError = "whole" | "range" | "order";

/** The offset is whole days 0–3650, strictly after the previous step and before the next one (as the API orders). */
export function offsetError(
  raw: string,
  previous: LadderStep | undefined,
  next: LadderStep | undefined,
): OffsetError | null {
  const text = raw.trim();
  if (!/^\d{1,4}$/.test(text)) return "whole";
  const value = Number(text);
  if (value > MAX_OFFSET) return "range";
  if ((previous && value <= previous.offsetDays) || (next && value >= next.offsetDays)) return "order";
  return null;
}

export function toggleChannel(channels: readonly CollectionChannel[], channel: CollectionChannel): CollectionChannel[] {
  const next = channels.includes(channel) ? channels.filter((c) => c !== channel) : [...channels, channel];
  return CHANNELS.filter((c) => next.includes(c));
}

export type StepError = OffsetError | "channels";

/** Everything wrong with a draft before it is sent; a step needs at least one channel to reach anyone. */
export function stepErrors(
  draft: StepDraft,
  previous: LadderStep | undefined,
  next: LadderStep | undefined,
): Partial<Record<"offsetDays" | "channels", StepError>> {
  const errors: Partial<Record<"offsetDays" | "channels", StepError>> = {};
  const offset = offsetError(draft.offsetDays, previous, next);
  if (offset) errors.offsetDays = offset;
  if (draft.channels.length === 0) errors.channels = "channels";
  return errors;
}

/** Only what changed (the PATCH applies to cases from their next step; an unchanged field is never re-sent). */
export function stepPatch(step: LadderStep, draft: StepDraft): Schemas["CollectionStepUpdateDto"] {
  const patch: Schemas["CollectionStepUpdateDto"] = {};
  const offset = Number(draft.offsetDays.trim());
  if (offset !== step.offsetDays) patch.offsetDays = offset;
  const sameChannels =
    draft.channels.length === step.channels.length && draft.channels.every((c) => step.channels.includes(c));
  if (!sameChannels) patch.channels = draft.channels;
  if (draft.requiresApproval !== step.requiresApproval) patch.requiresApproval = draft.requiresApproval;
  if (draft.enabled !== step.enabled) patch.enabled = draft.enabled;
  return patch;
}

export function isDirty(step: LadderStep, draft: StepDraft): boolean {
  return Object.keys(stepPatch(step, draft)).length > 0;
}

/**
 * The editor's own words for the two refusals of the PATCH (J1.2b): a legal measure whose gate is closed (the reason is
 * the problem's `gateClosedReason` since J-CR, `refusedGateReason`), or an approval that may not be dropped. Anything
 * else falls back to the standard problem notice.
 */
export function ladderRefusal(error: unknown): "legal" | "approval" | null {
  if (!isApiError(error)) return null;
  if (error.code === "collections.legal_review_required") return "legal";
  if (error.code === "collections.approval_required") return "approval";
  return null;
}

/** Gate reasons the console has words for (`collections.gate.<reason>`); others read as the general lock. */
export const GATE_REASONS = [
  "surcharge_disabled",
  "surcharge_cap_unset",
  "letter_wording_unverified",
  "suspend_services_disabled",
  "suspend_services_min_days_unset",
  "legal_action_disabled",
] as const;

export function gateReasonKey(reason: string | null): (typeof GATE_REASONS)[number] | "unknown" | null {
  if (reason === null) return null;
  return (GATE_REASONS as readonly string[]).includes(reason) ? (reason as (typeof GATE_REASONS)[number]) : "unknown";
}

/** Why the legal gate refused the change (`collections.legal_review_required` → `gateClosedReason`, J-CR, D-335). */
export function refusedGateReason(error: unknown): string | null {
  if (!isApiError(error) || error.code !== "collections.legal_review_required") return null;
  return error.problem.gateClosedReason ?? null;
}
