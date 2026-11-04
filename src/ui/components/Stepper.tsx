import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { cn } from "../lib/cn";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index of the current step. */
  current: number;
  /** Accessible name of the list ("Install steps"). */
  label: string;
  /** "Step {n} of {total}" in the page language. */
  progressText: string;
  /**
   * `dots` (default): numbered dots joined by lines. `bar`: "Step n of m", the current step's name as a title, then one
   * segment per step with its name under it — for a phone wizard where the names carry the way (staff installs).
   */
  variant?: "dots" | "bar";
  /** `dots` only: every step's name under its dot — for a short workflow read at a glance (maker → checker → published). */
  labelled?: boolean;
  className?: string;
}

/**
 * Wizard progress (design-system.md §4 "Wizard (lease, binding)"): an ordered list where done steps are
 * ticked and the current one is `aria-current="step"`. On a phone only the current label is shown
 * next to "step n of m"; the dots still show where you are.
 */
export function Stepper({
  steps,
  current,
  label,
  progressText,
  variant = "dots",
  labelled = false,
  className,
}: StepperProps) {
  if (variant === "bar")
    return (
      <nav aria-label={label} className={cn("flex flex-col gap-3", className)}>
        <div className="flex flex-col gap-0.5">
          {/* With every name under its dot the line repeats them on a wide screen; it stays for phones and readers. */}
          <p className={cn("text-muted text-sm", labelled && "md:sr-only")} data-testid="stepper-progress">
            {progressText}
          </p>
          <p className="text-xl font-semibold">{steps[current]?.label}</p>
        </div>
        <ol className="grid auto-cols-fr grid-flow-col gap-1.5">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex min-w-0 flex-col gap-1.5"
              aria-current={index === current ? "step" : undefined}
            >
              <span className={cn("h-1 rounded-full", index <= current ? "bg-primary" : "bg-border")} />
              <span className={cn("truncate text-xs", index === current ? "text-fg font-semibold" : "text-muted")}>
                {index < current ? <Icon icon={IconCheck} size={12} className="text-primary me-0.5 inline" /> : null}
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>
    );
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {/* With every name under its dot the line repeats them on a wide screen; it stays for phones and readers. */}
      <p className={cn("text-muted text-sm", labelled && "md:sr-only")} data-testid="stepper-progress">
        {progressText}
        <span className="text-fg ms-2 font-semibold">{steps[current]?.label}</span>
      </p>
      <ol className="flex items-center gap-1">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step.id}
              className={cn("flex flex-1 gap-1", labelled ? "flex-col" : "items-center")}
              aria-current={active ? "step" : undefined}
            >
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "bg-primary text-primary-fg border-transparent",
                    active && "border-primary text-primary border-2",
                    !done && !active && "border-border text-muted",
                  )}
                >
                  {done ? <Icon icon={IconCheck} size={14} /> : index + 1}
                  {labelled ? null : <span className="sr-only">{step.label}</span>}
                </span>
                {index < steps.length - 1 ? (
                  <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} />
                ) : null}
              </span>
              {labelled ? (
                <span className={cn("pe-2 text-sm", active ? "text-fg font-semibold" : "text-muted")}>
                  {step.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
