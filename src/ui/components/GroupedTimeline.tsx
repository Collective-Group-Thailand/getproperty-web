import { cn } from "../lib/cn";
import { Timeline, type TimelineEvent } from "./Timeline";

export interface TimelineGroup {
  key: string;
  /** "พฤศจิกายน 2569" — formatted by the caller. */
  label: React.ReactNode;
  events: TimelineEvent[];
}

/**
 * The collection timeline (J-DESIGN §4): what comes next pinned at the top on the pale tint, then the events grouped
 * by month, newest first — each with its icon, actor and time. The events are the API's append-only evidence; the
 * component only lays them out.
 */
export function GroupedTimeline({
  pinned,
  groups,
  empty,
  className,
  testId,
}: {
  /** The next scheduled step (title, date, a word on what holds it). */
  pinned?: React.ReactNode;
  groups: TimelineGroup[];
  empty?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} data-testid={testId}>
      {pinned ? (
        <div
          className="border-primary/20 bg-primary-subtle rounded-control border px-4 py-3"
          data-testid="timeline-next"
        >
          {pinned}
        </div>
      ) : null}
      {groups.length === 0
        ? empty
        : groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-4">
              <h3 className="text-muted text-sm font-medium">{group.label}</h3>
              <Timeline events={group.events} />
            </section>
          ))}
    </div>
  );
}
