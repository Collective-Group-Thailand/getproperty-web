import { cn } from "@/ui/lib/cn";

/**
 * A request that waits for an answer (G5): a mandate invitation, a co-broke proposal. Its title and status, the four
 * facts that decide it as a definition list, and the answers stacked on the right (on phones, under the facts).
 */
export function RequestCard({
  title,
  subtitle,
  status,
  facts,
  actions,
  testId,
  data,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  facts: { key: string; label: React.ReactNode; value: React.ReactNode }[];
  actions?: React.ReactNode;
  testId?: string;
  data?: Record<string, string | undefined>;
  className?: string;
}) {
  const dataAttributes = Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => [`data-${key}`, value]));
  return (
    <li
      className={cn(
        "rounded-card border-border bg-surface shadow-card flex flex-col gap-5 border p-5 md:flex-row md:items-start md:gap-8 md:p-6",
        className,
      )}
      data-testid={testId}
      {...dataAttributes}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {status}
          {subtitle ? <p className="text-muted m-0 w-full text-sm">{subtitle}</p> : null}
        </div>
        <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-muted text-sm">{fact.label}</dt>
              <dd className="m-0 text-sm font-medium break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {actions ? <div className="flex shrink-0 flex-col gap-2 md:w-48">{actions}</div> : null}
    </li>
  );
}
