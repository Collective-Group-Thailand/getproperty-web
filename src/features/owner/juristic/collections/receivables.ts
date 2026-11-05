import type { Schemas } from "@/lib/api/types";
import type { IconGlyph } from "@/ui/icons";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconDispute } from "@/ui/icons/glyphs/dispute";
import { IconLegal } from "@/ui/icons/glyphs/legal";
import { IconLetter } from "@/ui/icons/glyphs/letter";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
import { IconSuspendServices } from "@/ui/icons/glyphs/suspend-services";

export type ReceivablesTab = Schemas["ReceivablesTab"];
export type ReceivablesSort = Schemas["ReceivablesSort"];
export type SortOrder = Schemas["SortOrder"];
export type CollectionAction = Schemas["CollectionAction"];
export type CollectionChannel = Schemas["CollectionChannel"];

export const RECEIVABLE_TABS: readonly ReceivablesTab[] = ["all", "at_step", "plan", "dispute"];
export const RECEIVABLE_SORTS: readonly ReceivablesSort[] = ["amount", "age"];
export const PER_PAGE = 25;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export interface ReceivablesQuery {
  tab: ReceivablesTab;
  sort: ReceivablesSort;
  order: SortOrder;
  q: string | undefined;
  page: number;
}

/**
 * The list's state from its URL: unknown values fall back to the API's defaults (all · amount · largest first), so a
 * shared link never breaks the page. The page is 1-based.
 */
export function receivablesQuery(params: Params): ReceivablesQuery {
  const tab = one(params.tab);
  const sort = one(params.sort);
  const order = one(params.order);
  const page = Number(one(params.page));
  const q = one(params.q)?.trim();
  return {
    tab: RECEIVABLE_TABS.includes(tab as ReceivablesTab) ? (tab as ReceivablesTab) : "all",
    sort: RECEIVABLE_SORTS.includes(sort as ReceivablesSort) ? (sort as ReceivablesSort) : "amount",
    order: order === "asc" ? "asc" : "desc",
    q: q ? q.slice(0, 100) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * The sort a column header links to: the same column flips the order; another column starts with the largest
 * amount / the oldest debt first (`desc`). The page number starts again.
 */
export function sortLink(current: Pick<ReceivablesQuery, "sort" | "order">, column: ReceivablesSort) {
  if (current.sort === column) return { sort: column, order: current.order === "desc" ? "asc" : "desc" } as const;
  return { sort: column, order: "desc" } as const;
}

/** `aria-sort` of a sortable header. */
export function ariaSort(current: Pick<ReceivablesQuery, "sort" | "order">, column: ReceivablesSort) {
  if (current.sort !== column) return "none" as const;
  return current.order === "asc" ? ("ascending" as const) : ("descending" as const);
}

/**
 * The muted second line under the owner's name — the most valuable detail of the page (J-DESIGN §3): how many units
 * they own here, whether they live elsewhere, whether an agent is billed. Message keys with their values, in the
 * order they are read; empty when there is nothing to say.
 */
export function contextParts(context: Schemas["ReceivableContextDto"]): { key: string; count?: number }[] {
  const parts: { key: string; count?: number }[] = [];
  if (context.ownsUnits > 1) parts.push({ key: "ownsUnits", count: context.ownsUnits });
  if (context.nonResident) parts.push({ key: "nonResident" });
  if (context.agent) parts.push({ key: "agent" });
  return parts;
}

/** How each ladder step looks as a badge: icon + word, the tone only adds to the word (DESIGN status rule). */
export const ACTION_LOOK: Record<CollectionAction, { icon: IconGlyph; tone: "info" | "warning" | "danger" }> = {
  remind: { icon: IconBell, tone: "info" },
  surcharge: { icon: IconPercent, tone: "warning" },
  notice_letter: { icon: IconLetter, tone: "warning" },
  suspend_services: { icon: IconSuspendServices, tone: "danger" },
  lawyer_letter: { icon: IconLegal, tone: "danger" },
  legal_action: { icon: IconLegal, tone: "danger" },
};

export type NextStepBadge =
  | { kind: "dispute"; icon: IconGlyph; tone: "neutral" }
  | { kind: "plan"; icon: IconGlyph; tone: "primary" }
  | { kind: "approval"; action: CollectionAction; date: string; icon: IconGlyph; tone: "warning" }
  | { kind: "locked"; action: CollectionAction; date: string; icon: IconGlyph; tone: "neutral" }
  | { kind: "step"; action: CollectionAction; date: string; icon: IconGlyph; tone: "info" | "warning" | "danger" }
  | { kind: "none" };

/**
 * The "next step" column of a row, by precedence: an open dispute holds the ladder; then a payment plan; then a step
 * waiting for a committee decision; then a legal step counsel has not confirmed (O-038: a lock, never presented as
 * something that will happen); else the step and its date.
 */
export function nextStepBadge(
  row: Pick<Schemas["ReceivableRowDto"], "disputeOpen" | "planId" | "nextStep">,
): NextStepBadge {
  if (row.disputeOpen) return { kind: "dispute", icon: IconDispute, tone: "neutral" };
  if (row.planId) return { kind: "plan", icon: IconRepeat, tone: "primary" };
  const step = row.nextStep;
  if (!step) return { kind: "none" };
  if (step.awaitingApproval)
    return { kind: "approval", action: step.kind, date: step.date, icon: IconClock, tone: "warning" };
  if (step.legalReviewRequired)
    return { kind: "locked", action: step.kind, date: step.date, icon: IconLock, tone: "neutral" };
  return { kind: "step", action: step.kind, date: step.date, ...ACTION_LOOK[step.kind] };
}

const CHANNEL_ORDER: readonly CollectionChannel[] = ["line", "email", "sms", "letter"];

/** The channels the API listed, known ones only, in a fixed order (LINE first, paper last). */
export function channelList(channels: readonly string[]): CollectionChannel[] {
  return CHANNEL_ORDER.filter((channel) => channels.includes(channel));
}
