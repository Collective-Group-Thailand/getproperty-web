import { getTranslations } from "next-intl/server";

import { LEASE_STATUS, LEASE_VALUES } from "@/domain/status/lease";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconLease } from "@/ui/icons/glyphs/lease";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

/** Leases of the tenant (F2 2.2): status filter, search by unit or party, the focused building. */
export async function LeasesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.leases");
  const status = await getTranslations("status.lease");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const list = await unwrap(
    api.GET("/v1/owner/leases", {
      params: {
        query: {
          page: pageParam(searchParams.page),
          perPage: 25,
          q: param(searchParams.q),
          status: LEASE_VALUES.includes(statusParam as Schemas["LeaseStatus"])
            ? (statusParam as Schemas["LeaseStatus"])
            : undefined,
          buildingId: building?.id,
          sort: "startDate",
          order: "desc",
        },
      },
    }),
  );
  return (
    <OwnerPage testId="leases">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        actions={
          <Button asChild iconStart={IconAdd}>
            <a href={ownerPath(locale, "/leases/new")} data-testid="new-lease">
              {t("newTitle")}
            </a>
          </Button>
        }
      />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: LEASE_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconLease} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="lease-list">
          {list.data.map((lease) => (
            <li key={lease.id}>
              <a
                href={ownerPath(locale, `/leases/${lease.id}`)}
                className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-3"
                data-testid="lease-row"
                data-status={lease.status}
              >
                <span className="w-20 font-mono font-semibold">{lease.unitNo}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{lease.lesseeName ?? "—"}</span>
                  <span className="text-muted text-sm">
                    {t("period", {
                      start: formatDate(lease.startDate, locale),
                      end: formatDate(lease.endDate, locale),
                    })}
                    {lease.buildingName ? ` · ${lease.buildingName}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{formatTHB(lease.rent, locale)}</span>
                <StatusBadgeOf map={LEASE_STATUS} value={lease.status} size="sm" />
                <Icon icon={IconChevronRight} className="text-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/leases")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
