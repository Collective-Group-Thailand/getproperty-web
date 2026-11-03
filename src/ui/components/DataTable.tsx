"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import { Icon } from "../icons";
import { IconChevronDown } from "../icons/glyphs/chevron-down";
import { IconChevronUp } from "../icons/glyphs/chevron-up";
import { IconChevronsUpDown } from "../icons/glyphs/chevrons-up-down";
import { cn } from "../lib/cn";
import { Skeleton } from "./Skeleton";

export interface DataTableProps<Row> {
  columns: ColumnDef<Row, unknown>[];
  data: Row[];
  /** Accessible name of the table, from `src/i18n`. */
  caption: string;
  /** Rendered in place of rows: `<EmptyState>` / `<ErrorState>` from the caller. */
  empty?: React.ReactNode;
  loading?: boolean;
  /** Server-driven sorting (00-master-plan.md §4): the table reports, the caller refetches. */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  onRowClick?: (row: Row) => void;
  getRowId?: (row: Row) => string;
  density?: "compact" | "normal";
  /** Keeps the first column (the record's name or number) in view while the table scrolls sideways inside its box. */
  pinFirstColumn?: boolean;
  className?: string;
}

/**
 * The table base on TanStack (design-system.md §3). F0 ships columns, sorting, loading and empty
 * states; server pagination, filters, saved views, bulk actions and the export hook come with the
 * first owner list in F2. Money and quantity columns pass `meta: { numeric: true }` for tabular
 * right-aligned figures.
 */
export function DataTable<Row>({
  columns,
  data,
  caption,
  empty,
  loading = false,
  sorting: controlledSorting,
  onSortingChange,
  onRowClick,
  getRowId,
  density = "normal",
  pinFirstColumn = false,
  className,
}: DataTableProps<Row>) {
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const sorting = controlledSorting ?? localSorting;
  const manual = Boolean(onSortingChange);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unmemoisable functions; the compiler skips this hook, as intended.
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    manualSorting: manual,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (manual) onSortingChange?.(next);
      else setLocalSorting(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getRowId,
  });

  const cell = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  /** The pinned first column: sticky at the start edge, painted so rows slide under it, a hairline on its edge. */
  const pin = (index: number, background: string) =>
    pinFirstColumn && index === 0 ? cn("sticky start-0 z-1 border-border border-e", background) : undefined;

  return (
    <div className={cn("border-border bg-surface rounded-card shadow-card relative overflow-x-auto border", className)}>
      <table className="w-full text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-muted border-border border-b text-sm">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header, headerIndex) => {
                const numeric = (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined
                    }
                    className={cn(
                      "text-start font-medium whitespace-nowrap",
                      cell,
                      numeric && "text-end",
                      pin(headerIndex, "bg-surface"),
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "rounded-control hover:text-fg inline-flex items-center gap-1",
                          numeric && "flex-row-reverse",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <Icon
                          icon={
                            sorted === "asc" ? IconChevronUp : sorted === "desc" ? IconChevronDown : IconChevronsUpDown
                          }
                        />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-border border-t">
                {columns.map((_, j) => (
                  <td key={j} className={cell}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <tr className="border-border border-t">
              <td colSpan={columns.length} className="p-0">
                {empty}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "border-border group border-t first:border-t-0",
                  onRowClick && "hover:bg-bg-subtle cursor-pointer",
                )}
              >
                {row.getVisibleCells().map((c, cellIndex) => {
                  const numeric = (c.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                  return (
                    <td
                      key={c.id}
                      className={cn(
                        cell,
                        numeric && "text-end tabular-nums",
                        pin(cellIndex, cn("bg-surface", onRowClick && "group-hover:bg-bg-subtle")),
                      )}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
