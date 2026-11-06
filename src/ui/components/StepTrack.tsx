import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { cn } from "../lib/cn";

export interface StepTrackStep {
  key: string;
  label: React.ReactNode;
  /** One line under the name: where the step stands ("นำเข้า 248 แปลง", "กำลังตรวจสอบความถูกต้อง"). */
  line?: React.ReactNode;
  /** Tone of the line: success for a done step's result, primary for the current one, warning when it waits on the user. */
  lineTone?: "success" | "primary" | "warning" | "muted";
  status: "done" | "current" | "upcoming";
  /** Reopens a done step (read back); never set on upcoming steps. */
  href?: string;
}

const LINE_TONE = {
  success: "text-success-subtle-fg",
  primary: "text-primary",
  warning: "text-warning-subtle-fg",
  muted: "text-muted",
} as const;

/**
 * A long process in a few named steps with a status line under each (J-DESIGN §3 import wizard, Stitch
 * `import-wizard-desktop`): done steps ticked on the success tint and linkable, the current one filled brand blue and
 * `aria-current="step"`, the rest muted. One white card; from md the steps sit side by side, on phones they stack as a
 * compact list so every name and line stays readable. The order and statuses are the caller's (from the API).
 */
export function StepTrack({
  steps,
  label,
  selected,
  className,
  testId = "step-track",
}: {
  steps: StepTrackStep[];
  /** Accessible name of the list, from `src/i18n`. */
  label: string;
  /** The step being looked at, when it is a done step reopened (outlined). */
  selected?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <nav aria-label={label} className={className} data-testid={testId}>
      <ol
        className={cn(
          "rounded-card border-border bg-surface shadow-card grid border",
          "max-md:divide-border max-md:divide-y md:auto-cols-fr md:grid-flow-col md:gap-2 md:px-5 md:py-4",
        )}
      >
        {steps.map((step, index) => {
          const done = step.status === "done";
          const current = step.status === "current";
          const isSelected = selected === step.key && !current;
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums",
                  done && "bg-success-subtle text-success-subtle-fg border-transparent",
                  current && "bg-primary text-primary-fg border-transparent",
                  !done && !current && "border-border text-muted bg-surface",
                )}
              >
                {done ? <Icon icon={IconCheck} size={16} /> : index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm leading-snug font-semibold",
                    current ? "text-primary" : done ? "text-fg" : "text-muted",
                  )}
                >
                  <span className="tabular-nums">{index + 1}.</span> {step.label}
                </span>
                {step.line ? (
                  <span
                    className={cn(
                      "text-sm leading-snug",
                      LINE_TONE[step.lineTone ?? (done ? "success" : current ? "primary" : "muted")],
                    )}
                  >
                    {step.line}
                  </span>
                ) : null}
              </span>
            </>
          );
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              data-state={step.status}
              data-testid="step-track-step"
              className="min-w-0"
            >
              {step.href && !current ? (
                <a
                  href={step.href}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "rounded-control flex items-start gap-3 px-4 py-3 md:px-2 md:py-1.5",
                    "focus-visible:ring-focus-ring hover:bg-bg-subtle outline-none focus-visible:ring-2",
                    isSelected && "bg-bg-subtle",
                  )}
                >
                  {body}
                </a>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3 md:px-2 md:py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
