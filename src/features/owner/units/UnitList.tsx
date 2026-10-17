"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { DataTable } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconRoom } from "@/ui/icons/glyphs/room";

/**
 * The unit list (F2 2.1, DataTable): the API's page of `GET /v1/owner/units`, sorted on the server — a
 * header click replaces `sort`/`order` in the URL — with links to each unit.
 */
export function UnitList({ rows, prefix }: { rows: Schemas["UnitDto"][]; prefix: string }) {
  const t = useTranslations("owner.units.list");
  const types = useTranslations("owner.units.type");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sorting: SortingState = params.get("sort")
    ? [{ id: params.get("sort")!, desc: params.get("order") === "desc" }]
    : [{ id: "unitNo", desc: false }];

  const columns = useMemo<ColumnDef<Schemas["UnitDto"], unknown>[]>(
    () => [
      {
        id: "unitNo",
        accessorKey: "unitNo",
        header: t("unitNo"),
        cell: ({ row }) => (
          <a
            href={`${prefix}/units/${row.original.id}`}
            className="text-primary font-mono font-semibold underline-offset-4 hover:underline"
          >
            {row.original.unitNo}
          </a>
        ),
      },
      {
        id: "floorLevel",
        accessorKey: "floorLevel",
        header: t("floor"),
        cell: ({ row }) => row.original.floorLevel ?? "—",
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadgeOf map={UNIT_STATUS} value={row.original.status} size="sm" />,
      },
      { id: "type", accessorKey: "type", header: t("type"), cell: ({ row }) => types(row.original.type) },
      {
        id: "unitProfileName",
        accessorKey: "unitProfileName",
        header: t("profile"),
        enableSorting: false,
        cell: ({ row }) => row.original.unitProfileName ?? "—",
      },
      {
        id: "baseRent",
        accessorKey: "baseRent",
        header: t("baseRent"),
        meta: { numeric: true },
        cell: ({ row }) => (row.original.baseRent ? formatTHB(row.original.baseRent, locale) : "—"),
      },
      {
        id: "statusChangedAt",
        accessorKey: "statusChangedAt",
        header: t("since"),
        cell: ({ row }) => formatDate(row.original.statusChangedAt, locale),
      },
    ],
    [locale, prefix, t, types],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      caption={t("caption")}
      getRowId={(row) => row.id}
      sorting={sorting}
      onSortingChange={(next) => {
        const copy = new URLSearchParams(params.toString());
        const first = next[0];
        if (first) {
          copy.set("sort", first.id);
          copy.set("order", first.desc ? "desc" : "asc");
        } else {
          copy.delete("sort");
          copy.delete("order");
        }
        copy.delete("page");
        router.replace(`${pathname}?${copy.toString()}`, { scroll: false });
      }}
      empty={<EmptyState icon={IconRoom} title={t("empty")} />}
    />
  );
}
