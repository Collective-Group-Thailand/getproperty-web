import { cn } from "@/ui/lib/cn";

export interface SimpleColumn {
  key: string;
  header: React.ReactNode;
  align?: "start" | "end" | "center";
  /** Extra classes for the header and the cells of this column. */
  className?: string;
}

export interface SimpleRow {
  key: string;
  cells: Record<string, React.ReactNode>;
  testId?: string;
  /** `data-*` attributes of the row (status, id) for the e2e suite. */
  data?: Record<string, string | number | boolean | null | undefined>;
  tone?: "default" | "warning" | "danger";
  /** The record this row opens: the first cell becomes its link and the whole row is the click target. */
  href?: string;
}

const ALIGN = { start: "text-start", end: "text-end tabular-nums", center: "text-center" } as const;

/**
 * A plain, server-rendered table of a console list (admin, owner; `src/ui` so a row tone can use the warning/danger tokens): a caption for screen readers,
 * column headers with `scope`, horizontal scroll inside its own box on narrow screens (never the page),
 * and `data-*` hooks on rows. No client JavaScript — sorting and paging are URL parameters of the page.
 */
export function SimpleTable({
  caption,
  columns,
  rows,
  testId,
  minWidth = "40rem",
  pinFirstColumn,
  className,
}: {
  caption: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
  testId?: string;
  minWidth?: string;
  /**
   * Keep the first column in view while the table scrolls sideways inside its box. Default: on, unless rows open a
   * record (`href`) — the whole row is then the link, and a sticky cell would hold the row's click target to itself.
   */
  pinFirstColumn?: boolean;
  className?: string;
}) {
  const pinned = pinFirstColumn ?? !rows.some((row) => row.href);
  const pin = (index: number) =>
    pinned && index === 0 ? "sticky start-0 z-1 bg-surface group-hover:bg-bg-subtle" : undefined;
  return (
    <div className={cn("border-border bg-surface rounded-card shadow-card relative overflow-x-auto border", className)}>
      <table className="w-full text-base" style={{ minWidth }} data-testid={testId}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border text-muted border-b">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                  ALIGN[column.align ?? "start"],
                  index === 0 && pinned && "bg-surface sticky start-0 z-1",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "border-border group border-b last:border-b-0",
                row.href && "hover:bg-bg-subtle relative cursor-pointer",
                row.tone === "danger" && "bg-danger-subtle/40",
                row.tone === "warning" && "bg-warning-subtle/40",
              )}
              data-testid={row.testId}
              {...Object.fromEntries(
                Object.entries(row.data ?? {})
                  .filter(([, value]) => value !== undefined && value !== null)
                  .map(([name, value]) => [`data-${name}`, String(value)]),
              )}
            >
              {columns.map((column, index) =>
                index === 0 ? (
                  <th
                    key={column.key}
                    scope="row"
                    className={cn(
                      "px-4 py-3 align-top font-normal",
                      ALIGN[column.align ?? "start"],
                      pin(index),
                      column.className,
                    )}
                  >
                    {row.href ? (
                      <a
                        href={row.href}
                        className="text-fg font-medium after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        {row.cells[column.key] ?? "—"}
                      </a>
                    ) : (
                      (row.cells[column.key] ?? "—")
                    )}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={cn("px-4 py-3 align-top", ALIGN[column.align ?? "start"], pin(index), column.className)}
                  >
                    {row.cells[column.key] ?? "—"}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
