import { getTranslations } from "next-intl/server";

import { LEASE_STATUS, LEASE_VALUES } from "@/domain/status/lease";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconLease } from "@/ui/icons/glyphs/lease";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { viewCounts } from "../shared/views";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS = ["all", "active", "pending_signature", "draft", "notice_given", "ending", "ended"] as const;

/**
 * Leases of the tenant (F2 2.2, G3): status views with the API's counts, search by unit or party, the focused
 * building; a table whose rows open the lease (rows of their own on a phone). The section's other pages (contract
 * library, other contracts, renewals, employer housing) sit under "Leases" in the sidebar.
 */
export async function LeasesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.leases");
  const status = await getTranslations("status.lease");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const view = LEASE_VALUES.includes(statusParam as Schemas["LeaseStatus"])
    ? (statusParam as Schemas["LeaseStatus"])
    : "all";
  const q = param(searchParams.q);
  const [list, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/leases", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q,
            status: view === "all" ? undefined : view,
            buildingId: building?.id,
            sort: "startDate",
            order: "desc",
          },
        },
      }),
    ),
    viewCounts(VIEWS, (key) =>
      unwrap(
        api.GET("/v1/owner/leases", {
          params: {
            query: { perPage: 1, q, buildingId: building?.id, status: key === "all" ? undefined : key },
          },
        }),
      ),
    ),
  ]);
  const href = (key: string) => ownerPath(locale, withQuery("/leases", { q, status: key === "all" ? undefined : key }));
  const filtered = Boolean(q || view !== "all");
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
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("views.label")}
            current={view}
            tabs={VIEWS.map((key) => ({
              key,
              href: href(key),
              label: key === "all" ? t("views.all") : status(key),
              count: counts[key],
              testId: `lease-view-${key}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconLease}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/leases")}>{t("empty.clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary" iconStart={IconAdd}>
                <a href={ownerPath(locale, "/leases/new")}>{t("newTitle")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="lease-list"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "unit", header: t("column.unit"), phone: "meta", className: "w-24" },
            { key: "lessee", header: t("column.lessee"), phone: "title" },
            { key: "term", header: t("column.term"), phone: "meta" },
            { key: "status", header: t("column.status"), phone: "status" },
            { key: "rent", header: t("column.rent"), align: "end", phone: "figure" },
          ]}
          rows={list.data.map((lease) => ({
            key: lease.id,
            href: ownerPath(locale, `/leases/${lease.id}`),
            testId: "lease-row",
            data: { status: lease.status },
            cells: {
              unit: (
                <span className="flex flex-col max-md:flex-row max-md:gap-1">
                  <span className="font-mono">{lease.unitNo}</span>
                  {lease.buildingName ? (
                    <span className="text-muted text-sm font-normal max-md:hidden">{lease.buildingName}</span>
                  ) : null}
                </span>
              ),
              lessee: <span className="truncate">{lease.lesseeName ?? "—"}</span>,
              term: (
                <span className="text-muted whitespace-nowrap">
                  {t("period", {
                    start: formatDate(lease.startDate, locale),
                    end: formatDate(lease.endDate, locale),
                  })}
                </span>
              ),
              status: <StatusBadgeOf map={LEASE_STATUS} value={lease.status} size="sm" />,
              rent: <span className="font-medium whitespace-nowrap">{formatTHB(lease.rent, locale)}</span>,
            },
          }))}
        />
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
