import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { cn } from "../lib/cn";
import { FormSection } from "./FormLayout";

export interface WizardStep {
  key: string;
  label: React.ReactNode;
  /** One line of what was chosen, shown once the step is done. */
  summary?: React.ReactNode;
  /** Reopens a done step ("แก้ไข"); leave out where it cannot be changed any more. */
  edit?: React.ReactNode;
}

/**
 * A step-by-step form as numbered sections (REDESIGN-PROMPT §4.8, G3): every step is named, the done ones collapse
 * to one line with what was chosen (and a way back), the current one is open as a `FormSection`, the next ones wait
 * as quiet numbered rows — no dots without words.
 */
export function WizardSections({
  steps,
  current,
  children,
  testId,
}: {
  steps: WizardStep[];
  /** Index of the open step. */
  current: number;
  /** The open step's fields. */
  children: React.ReactNode;
  testId?: string;
}) {
  const row = (step: WizardStep, position: number) => {
    const done = position < current;
    return (
      <section
        key={step.key}
        className={cn(
          "rounded-card border-border flex items-center gap-3 border px-5 py-3.5 md:px-6",
          done ? "bg-surface" : "bg-bg-subtle/60 border-dashed",
        )}
        data-testid="wizard-outline"
        data-state={done ? "done" : "next"}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
            done ? "bg-primary text-primary-fg" : "border-border text-muted border",
          )}
        >
          {done ? <Icon icon={IconCheck} size={14} /> : position + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <h2 className={cn("text-base font-medium", !done && "text-muted")}>{step.label}</h2>
          {done && step.summary ? <span className="text-muted truncate text-sm">{step.summary}</span> : null}
        </span>
        {done ? step.edit : null}
      </section>
    );
  };
  const open = steps[current];
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {steps.slice(0, current).map((step, position) => row(step, position))}
      {open ? (
        <FormSection number={current + 1} title={open.label} testId="wizard-current">
          {children}
        </FormSection>
      ) : (
        children
      )}
      {steps.slice(current + 1).map((step, offset) => row(step, current + 1 + offset))}
    </div>
  );
}
