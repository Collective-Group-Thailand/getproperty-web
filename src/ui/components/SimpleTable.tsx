import { cn } from "@/ui/lib/cn";

/**
 * Where a column goes when the table becomes rows on a phone (`stackOnPhones`): the `title` and the `figure` share the
 * first line, `meta` lines follow under the title, `status` sits under the figure, `hidden` is left out.
 */
export type PhoneSlot = "title" | "figure" | "meta" | "status" | "wide" | "hidden";

export interface SimpleColumn {
  key: string;
  header: React.ReactNode;
  align?: "start" | "end" | "center";
  /** Extra classes for the header and the cells of this column. */
  className?: string;
  /** The column's place in a phone row (`stackOnPhones`); default `meta`. */
  phone?: PhoneSlot;
  /** In a phone row, name the value with the column's header ("ออนไลน์ 3"): for bare numbers that mean nothing alone. */
  phoneLabel?: boolean;
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

/** Phone placement of a cell in a stacked row: a two-column grid, title + figure on the first line. */
const SLOT: Record<PhoneSlot, string> = {
  title: "max-md:col-start-1 max-md:row-start-1 max-md:font-medium",
  figure: "max-md:col-start-2 max-md:row-start-1 max-md:text-end max-md:font-medium",
  meta: "max-md:col-start-1 max-md:text-start max-md:text-sm max-md:text-muted",
  status: "max-md:col-start-2 max-md:row-start-2 max-md:justify-self-end max-md:text-end",
  /** A long cell (a list of problems, a note) across the whole stacked row, under the details. */
  wide: "max-md:col-span-2 max-md:text-start max-md:text-sm",
  hidden: "max-md:hidden",
};

/**
 * A plain, server-rendered table of a console list (admin, owner; `src/ui` so a row tone can use the warning/danger tokens): a caption for screen readers,
 * column headers with `scope`, horizontal scroll inside its own box on narrow screens (never the page),
 * and `data-*` hooks on rows. No client JavaScript — sorting and paging are URL parameters of the page.
 *
 * `stackOnPhones` (REDESIGN-PROMPT §4.5): below `md` the same rows become a list of rows — no header, each row a
 * two-column block (title and figure on top, details under them, the status at the end) — one DOM for both layouts,
 * so the row's link, its `data-*` hooks and its cells exist once.
 */
export function SimpleTable({
  caption,
  columns,
  rows,
  testId,
  minWidth = "40rem",
  pinFirstColumn,
  stackOnPhones = false,
  footer,
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
  /** Rows instead of a sideways-scrolling table on phones (see `SimpleColumn.phone`). */
  stackOnPhones?: boolean;
  /** A totals row ("รวมทั้งสิ้น") under the rows, cells by column key — API figures only, never summed here. */
  footer?: Record<string, React.ReactNode>;
  className?: string;
}) {
  const pinned = pinFirstColumn ?? !rows.some((row) => row.href);
  const pin = (index: number) =>
    pinned && index === 0 ? "sticky start-0 z-1 bg-surface group-hover:bg-bg-subtle" : undefined;
  const slot = (column: SimpleColumn, index: number) =>
    stackOnPhones ? SLOT[column.phone ?? (index === 0 ? "title" : "meta")] : undefined;
  // A box that scrolls sideways must be reachable from the keyboard (WCAG 2.1.1, axe scrollable-region-focusable):
  // rows that open a record already give it focusable links; otherwise the box itself is a named, focusable region.
  const region = rows.some((row) => row.href) ? {} : ({ tabIndex: 0, role: "region", "aria-label": caption } as const);
  return (
    <div
      className={cn(
        "border-border bg-surface rounded-card shadow-card relative border",
        stackOnPhones ? "relative md:overflow-x-auto" : "relative overflow-x-auto",
        "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...region}
    >
      <table
        className={cn(
          "w-full text-base",
          stackOnPhones ? "max-md:block md:min-w-(--table-min)" : "min-w-(--table-min)",
        )}
        style={{ "--table-min": minWidth } as React.CSSProperties}
        data-testid={testId}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className={cn(stackOnPhones && "max-md:sr-only")}>
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
        <tbody className={cn(stackOnPhones && "max-md:block")}>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "border-border group border-b last:border-b-0",
                stackOnPhones &&
                  "max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-baseline max-md:gap-x-4 max-md:gap-y-0.5 max-md:px-4 max-md:py-3",
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
              {columns.map((column, index) => {
                const cellClass = cn(
                  "px-4 py-3 align-top",
                  stackOnPhones && "max-md:min-w-0 max-md:p-0",
                  ALIGN[column.align ?? "start"],
                  pin(index),
                  column.className,
                  slot(column, index),
                );
                return index === 0 ? (
                  <th key={column.key} scope="row" className={cn("font-normal", cellClass)}>
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
                  <td key={column.key} className={cellClass}>
                    {stackOnPhones && column.phoneLabel ? (
                      <span className="text-muted me-1.5 md:hidden" aria-hidden="true">
                        {column.header}
                      </span>
                    ) : null}
                    {row.cells[column.key] ?? "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot className={cn(stackOnPhones && "max-md:hidden")}>
            <tr className="border-fg border-t">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th
                    key={column.key}
                    scope="row"
                    className={cn("px-4 py-3 text-start font-semibold", pin(index), column.className)}
                  >
                    {footer[column.key] ?? null}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 font-semibold tabular-nums",
                      ALIGN[column.align ?? "start"],
                      column.className,
                    )}
                  >
                    {footer[column.key] ?? null}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
