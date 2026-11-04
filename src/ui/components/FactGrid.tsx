import { cn } from "../lib/cn";

export interface Fact {
  key: string;
  label: React.ReactNode;
  /** Already formatted from the API's own value — never computed here. */
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** A fact that needs attention: a pale tint and the tone's ink (the status word stays in the value or hint). */
  tone?: "warning" | "danger";
  /** Numbers and money: right-aligned, tabular. */
  numeric?: boolean;
  testId?: string;
}

/**
 * A record's key facts as a hairline grid (account health, a device, a rollout): label over value, three per row on a
 * wide screen, two on a phone. Lives inside a card; the cell that needs attention is tinted — never a stripe.
 */
export function FactGrid({
  facts,
  columns = 3,
  label,
  className,
}: {
  facts: Fact[];
  columns?: 2 | 3 | 4;
  /** Accessible name of the list, from `src/i18n`. */
  label?: string;
  className?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "border-border rounded-control grid grid-cols-2 overflow-hidden border",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {facts.map((fact) => (
        <div
          key={fact.key}
          data-testid={fact.testId}
          className={cn(
            "border-border -ms-px -mt-px flex min-w-0 flex-col gap-1 border-s border-t px-4 py-3.5",
            fact.tone === "warning" && "bg-warning-subtle text-warning-subtle-fg",
            fact.tone === "danger" && "bg-danger-subtle text-danger-subtle-fg",
          )}
        >
          <dt className={cn("text-sm", fact.tone ? "font-medium" : "text-muted")}>{fact.label}</dt>
          <dd className={cn("min-w-0 font-semibold break-words", fact.numeric && "text-end tabular-nums")}>
            {fact.value}
          </dd>
          {fact.hint ? <dd className={cn("text-sm", fact.tone ? "" : "text-muted")}>{fact.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
