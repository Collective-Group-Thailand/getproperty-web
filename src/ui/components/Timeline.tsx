import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface TimelineEvent {
  id: string;
  title: React.ReactNode;
  /** Formatted by the caller: `formatRelativeTime` with the absolute time as `timeTitle`. */
  time: React.ReactNode;
  timeTitle?: string;
  actor?: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconName;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  /** Evidence thumbnails (meter photos, slips) rendered by the caller. */
  evidence?: React.ReactNode;
}

const TONE: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  neutral: "bg-neutral-subtle text-neutral-subtle-fg",
  primary: "bg-primary-subtle text-primary-subtle-fg",
  success: "bg-success-subtle text-success-subtle-fg",
  warning: "bg-warning-subtle text-warning-subtle-fg",
  danger: "bg-danger-subtle text-danger-subtle-fg",
};

/** Events with actor, time and evidence (design-system.md §3) — a bill's life, a lease's history. */
export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-6 ps-9", className)}>
      <span aria-hidden="true" className="bg-border absolute start-3.5 top-2 bottom-2 w-px" />
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={cn(
              "absolute -start-9 flex size-7 items-center justify-center rounded-full text-sm",
              TONE[event.tone ?? "neutral"],
            )}
          >
            <Icon name={event.icon ?? "dot"} />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-medium">{event.title}</p>
            <time className="text-muted text-sm tabular-nums" title={event.timeTitle}>
              {event.time}
            </time>
          </div>
          {event.actor ? <p className="text-muted text-sm">{event.actor}</p> : null}
          {event.description ? <p className="mt-1 text-sm">{event.description}</p> : null}
          {event.evidence ? <div className="mt-2 flex gap-2">{event.evidence}</div> : null}
        </li>
      ))}
    </ol>
  );
}
