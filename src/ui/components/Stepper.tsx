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
  className?: string;
}

/**
 * Wizard progress (design-system.md §4 "Wizard (lease, binding)"): an ordered list where done steps are
 * ticked and the current one is `aria-current="step"`. On a phone only the current label is shown
 * next to "step n of m"; the dots still show where you are.
 */
export function Stepper({ steps, current, label, progressText, className }: StepperProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-2", className)}>
      <p className="text-muted text-sm" data-testid="stepper-progress">
        {progressText}
        <span className="text-fg ms-2 font-semibold">{steps[current]?.label}</span>
      </p>
      <ol className="flex items-center gap-1">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-1" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "bg-primary text-primary-fg border-transparent",
                  active && "border-primary text-primary border-2",
                  !done && !active && "border-border text-muted",
                )}
              >
                {done ? <Icon icon={IconCheck} size={14} /> : index + 1}
                <span className="sr-only">{step.label}</span>
              </span>
              {index < steps.length - 1 ? (
                <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
