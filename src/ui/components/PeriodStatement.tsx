import { cn } from "../lib/cn";

export interface PeriodStatementRow {
  key: string;
  /** `heading`: a section label; `line`: an account; `subtotal`: a rule above; `result`: a rule above, double under. */
  kind: "heading" | "line" | "subtotal" | "result";
  label: React.ReactNode;
  /** The account code, set in mono before the name. */
  code?: React.ReactNode;
  /** Formatted by the caller from the API's figures: one per period, then the total. */
  values: React.ReactNode[];
  testId?: string;
}

/**
 * A financial statement with a column per period (J-DESIGN paper statement, JW2a): the account column and the total
 * column stay in view while twelve months scroll sideways between them; the total is set apart by a hairline and weight; headings, subtotals
 * with a rule above and the result with a double rule under, as an accountant's working paper. Dense on purpose —
 * figures are 14 px tabular numerals so a year fits a laptop. The table never computes: every figure is the caller's
 * formatted API string.
 */
export function PeriodStatement({
  caption,
  accountHeader,
  periods,
  totalHeader,
  rows,
  testId,
  className,
}: {
  /** Accessible name, from `src/i18n`. */
  caption: string;
  accountHeader: React.ReactNode;
  /** Column headings of the periods. */
  periods: React.ReactNode[];
  totalHeader: React.ReactNode;
  rows: PeriodStatementRow[];
  testId?: string;
  className?: string;
}) {
  const columns = periods.length + 1;
  const strong = (kind: PeriodStatementRow["kind"]) => kind !== "line";
  const pin = "bg-surface sticky start-0 z-1";
  return (
    <div className={cn("relative overflow-x-auto", className)}>
      <table
        className="w-full min-w-(--statement-min) border-collapse text-sm"
        style={{ "--statement-min": `${16 + columns * 6.5}rem` } as React.CSSProperties}
        data-testid={testId}
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-fg border-b">
            <th scope="col" className={cn(pin, "text-muted w-44 py-2 pe-4 text-start text-sm font-medium md:w-auto")}>
              {accountHeader}
            </th>
            {periods.map((period, index) => (
              <th
                key={index}
                scope="col"
                className="text-muted px-2 py-2 text-end text-sm font-medium whitespace-nowrap"
              >
                {period}
              </th>
            ))}
            <th
              scope="col"
              className="border-border bg-surface text-fg z-1 border-s px-3 py-2 text-end text-sm font-semibold whitespace-nowrap md:sticky md:end-0"
            >
              {totalHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isTotal = row.kind === "subtotal" || row.kind === "result";
            return (
              <tr
                key={row.key}
                data-testid={row.testId}
                className={cn(row.kind === "line" && "hover:bg-bg-subtle group")}
              >
                <th
                  scope="row"
                  colSpan={row.kind === "heading" ? columns + 1 : undefined}
                  className={cn(
                    pin,
                    "w-44 py-1.5 pe-4 text-start align-baseline md:w-auto",
                    row.kind === "line" && "group-hover:bg-bg-subtle ps-4 font-normal",
                    row.kind === "heading" && "pt-6 pb-1 text-base font-semibold",
                    isTotal && "font-semibold",
                    isTotal && "border-fg border-t",
                    row.kind === "result" && "border-b-[3px] border-double",
                  )}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    {row.code ? (
                      <span className="text-muted shrink-0 font-mono text-xs tabular-nums">{row.code}</span>
                    ) : null}
                    <span className="min-w-0">{row.label}</span>
                  </span>
                </th>
                {row.kind === "heading"
                  ? null
                  : row.values.map((value, index) => {
                      const last = index === row.values.length - 1;
                      return (
                        <td
                          key={index}
                          className={cn(
                            "px-2 py-1.5 text-end align-baseline whitespace-nowrap tabular-nums",
                            strong(row.kind) && "font-semibold",
                            last && "border-border bg-surface z-1 border-s px-3 font-medium md:sticky md:end-0",
                            last && row.kind === "line" && "group-hover:bg-bg-subtle",
                            isTotal && "border-fg border-t",
                            row.kind === "result" && "border-b-[3px] border-double",
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
