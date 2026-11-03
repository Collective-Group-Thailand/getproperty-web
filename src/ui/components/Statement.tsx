import { cn } from "../lib/cn";

export interface StatementLine {
  key: string;
  label: React.ReactNode;
  /** Formatted by the caller from the API's figure (`formatTHB`); the statement never adds lines up. */
  value?: React.ReactNode;
  /** 0 = heading or top line, 1–2 = indented detail. */
  level?: 0 | 1 | 2;
  /**
   * `heading`: a section label without a figure; `subtotal`: a rule above; `result`: a rule above and a double rule
   * under (net income, balance due).
   */
  kind?: "line" | "heading" | "subtotal" | "result";
  testId?: string;
}

/**
 * A financial statement (REDESIGN-PROMPT §4.12): indentation for detail, a rule over each subtotal, a double rule under
 * the result, figures right-aligned in tabular numerals. `columns` adds period headings for comparatives.
 */
export function Statement({
  lines,
  caption,
  columns,
  className,
}: {
  lines: (StatementLine & { values?: React.ReactNode[] })[];
  /** Accessible name, from `src/i18n`. */
  caption: string;
  /** Headings of the figure columns (periods); one column when omitted. */
  columns?: React.ReactNode[];
  className?: string;
}) {
  const count = columns?.length ?? 1;
  return (
    <table className={cn("w-full border-collapse text-base", className)}>
      <caption className="sr-only">{caption}</caption>
      {columns ? (
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="py-2" />
            {columns.map((column, index) => (
              <th key={index} scope="col" className="text-muted py-2 ps-6 text-end text-sm font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {lines.map((line) => {
          const kind = line.kind ?? "line";
          const values = line.values ?? (line.value !== undefined ? [line.value] : []);
          const strong = kind === "subtotal" || kind === "result" || kind === "heading";
          return (
            <tr key={line.key} data-testid={line.testId}>
              <th
                scope="row"
                className={cn(
                  "py-1.5 text-start align-baseline",
                  strong ? "font-semibold" : "font-normal",
                  kind === "heading" && "pt-5",
                  line.level === 1 && "ps-5",
                  line.level === 2 && "ps-10",
                  kind !== "heading" && line.level ? "text-muted" : "",
                )}
              >
                {line.label}
              </th>
              {Array.from({ length: count }, (_, index) => (
                <td
                  key={index}
                  className={cn(
                    "py-1.5 ps-6 text-end align-baseline whitespace-nowrap tabular-nums",
                    strong && "font-semibold",
                    (kind === "subtotal" || kind === "result") && "border-fg border-t",
                    kind === "result" && "border-b-[3px] border-double",
                  )}
                >
                  {values[index] ?? ""}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
