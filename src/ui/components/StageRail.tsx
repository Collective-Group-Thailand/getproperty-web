import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { cn } from "../lib/cn";

/**
 * Where a process stands (a billing cycle: open → readings → review → issued → closed), as a compact vertical rail
 * for a side card: done stages ticked, the current one ringed in brand blue and named, the rest muted. The order and
 * the current stage come from the API's status; the rail only shows them.
 */
export function StageRail({
  stages,
  current,
  label,
  className,
}: {
  stages: { key: string; label: React.ReactNode; detail?: React.ReactNode }[];
  /** Index of the current stage; `stages.length` when every stage is done. */
  current: number;
  /** Accessible name of the list, from `src/i18n`. */
  label: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)} data-testid="stage-rail">
      {stages.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={stage.key}
            className="relative flex gap-3 pb-3 last:pb-0"
            aria-current={active ? "step" : undefined}
            data-state={done ? "done" : active ? "current" : "next"}
          >
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn("absolute start-[0.6875rem] top-6 bottom-0 w-px", done ? "bg-primary" : "bg-border")}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                done && "bg-primary text-primary-fg border-transparent",
                active && "border-primary text-primary bg-surface border-2",
                !done && !active && "border-border text-muted bg-surface",
              )}
            >
              {done ? <Icon icon={IconCheck} size={12} /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col pt-0.5">
              <span className={cn("text-sm", active ? "text-fg font-semibold" : done ? "text-fg" : "text-muted")}>
                {stage.label}
              </span>
              {stage.detail && active ? <span className="text-muted text-sm">{stage.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
