import { cn } from "../lib/cn";

/**
 * A document as paper (REDESIGN-PROMPT §4.6): an invoice, a receipt, a lease, a deposit statement shown the way it
 * reads when printed — a white sheet with generous margins, the document's name and number at the top, the parties,
 * the body, the totals as a right-aligned statement, a quiet footer. Figures come formatted from the caller (API
 * strings through `formatTHB`); the sheet never computes.
 */
export function Paper({
  children,
  label,
  className,
  testId,
}: {
  children: React.ReactNode;
  /** Accessible name of the document region, from `src/i18n` ("ใบแจ้งหนี้ INV-2569-000101"). */
  label: string;
  className?: string;
  testId?: string;
}) {
  return (
    <article
      aria-label={label}
      className={cn(
        "rounded-card border-border bg-surface shadow-card flex flex-col gap-8 border px-5 py-6 md:px-10 md:py-10 print:border-0 print:shadow-none",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </article>
  );
}

/** The head of the sheet: the document's kind and number on the left, its key dates on the right. */
export function PaperHead({
  kind,
  number,
  status,
  facts,
}: {
  /** "ใบแจ้งหนี้", "สัญญาเช่า" — the document's name. */
  kind: React.ReactNode;
  /** The document number (mono, tabular), or a word for a draft. */
  number?: React.ReactNode;
  status?: React.ReactNode;
  facts?: { key: string; label: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <header className="border-border flex flex-col gap-5 border-b pb-6 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted text-sm font-medium">{kind}</p>
        {number ? <p className="font-mono text-xl font-semibold tracking-tight tabular-nums">{number}</p> : null}
        {status ? <div className="mt-1 flex flex-wrap gap-1.5">{status}</div> : null}
      </div>
      {facts && facts.length > 0 ? (
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-sm md:text-end">
          {facts.map((fact) => (
            <div key={fact.key} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd className="text-end font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

/** The parties of a document side by side (billed to · unit · lease; landlord · resident). */
export function PaperParties({
  items,
}: {
  items: { key: string; label: React.ReactNode; value: React.ReactNode; detail?: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-muted text-sm">{item.label}</dt>
          <dd className="font-medium break-words">{item.value}</dd>
          {item.detail ? <dd className="text-muted text-sm">{item.detail}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** A titled part of the sheet (the lines, the terms, the deductions). */
export function PaperSection({
  title,
  children,
  aside,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  /** A small action at the section's head (the PDF, "show photos"). */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title || aside ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The totals block: a `Statement` set against the right margin, as on a printed invoice. */
export function PaperTotals({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex justify-end" data-testid={testId}>
      <div className="w-full sm:max-w-sm">{children}</div>
    </div>
  );
}

/** The foot of the sheet: how to pay, a reference, a note — small and muted. */
export function PaperFoot({ children }: { children: React.ReactNode }) {
  return (
    <footer className="border-border text-muted flex flex-col gap-3 border-t pt-6 text-sm md:flex-row md:items-start md:justify-between">
      {children}
    </footer>
  );
}
