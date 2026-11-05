import type { Schemas } from "@/lib/api/types";
import type { IconGlyph } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconDispute } from "@/ui/icons/glyphs/dispute";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconPause } from "@/ui/icons/glyphs/pause";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ACTION_LOOK } from "./receivables";

export type CollectionEvent = Schemas["CollectionEventDto"];
type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

/** The Bangkok calendar month of an instant (`YYYY-MM`), the timeline's grouping. */
export function bangkokMonth(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
    .formatToParts(new Date(instant))
    .reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}`;
}

/**
 * The case's events grouped by month, newest month first and newest event first inside a month (J-DESIGN §4 collection
 * timeline). The API's timeline is append-only evidence: nothing is merged or dropped, ties keep the API's order.
 */
export function timelineGroups(events: readonly CollectionEvent[]): { month: string; events: CollectionEvent[] }[] {
  const indexed = events.map((event, index) => ({ event, index }));
  indexed.sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.index - a.index);
  const groups: { month: string; events: CollectionEvent[] }[] = [];
  for (const { event } of indexed) {
    const month = bangkokMonth(event.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.events.push(event);
    else groups.push({ month, events: [event] });
  }
  return groups;
}

const OUTCOME_TONE: Record<Schemas["CollectionOutcome"], Tone> = {
  sent: "primary",
  approved: "success",
  awaiting_approval: "warning",
  skipped: "neutral",
  refused: "neutral",
  failed: "danger",
};

/**
 * How an event reads on the timeline: its icon (the step's own for a step, else the event's), its tone, and the message
 * key of its title (`collections.event.<kind>` or `collections.step.<action>`).
 */
export function eventLook(event: CollectionEvent): { icon: IconGlyph; tone: Tone; title: string } {
  switch (event.kind) {
    case "step": {
      const outcome = event.outcome ?? "sent";
      const icon =
        outcome === "failed"
          ? IconAlert
          : outcome === "awaiting_approval"
            ? IconClock
            : outcome === "refused" || outcome === "skipped"
              ? IconXCircle
              : event.action
                ? ACTION_LOOK[event.action].icon
                : IconFlag;
      return { icon, tone: OUTCOME_TONE[outcome], title: event.action ? `action.${event.action}` : "event.step" };
    }
    case "opened":
      return { icon: IconFlag, tone: "neutral", title: "event.opened" };
    case "paused":
      return { icon: IconPause, tone: "neutral", title: "event.paused" };
    case "resumed":
      return { icon: IconPlay, tone: "neutral", title: "event.resumed" };
    case "dispute_opened":
      return { icon: IconDispute, tone: "warning", title: "event.dispute_opened" };
    case "dispute_closed":
      return { icon: IconDispute, tone: "neutral", title: "event.dispute_closed" };
    case "resolved":
      return { icon: IconCheckCircle, tone: "success", title: "event.resolved" };
  }
}

/**
 * The step pinned at the top of the timeline on the pale tint: the next one the ladder will take — none once the case
 * is resolved. While a plan or a dispute pauses the case the step stays visible (it moves back by the paused days).
 */
export function pinnedStep(collectionCase: Pick<Schemas["CollectionCaseDto"], "state" | "nextStep">) {
  if (collectionCase.state === "resolved") return null;
  return collectionCase.nextStep ?? null;
}
