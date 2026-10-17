import { getTranslations } from "next-intl/server";

import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SavedViews } from "../shared/SavedViews";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { UnitBoard } from "./UnitBoard";
import { UnitList } from "./UnitList";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Units of a building (F2 2.1): the unit board (map) or the unit list (DataTable, saved views). The
 * building comes from `?building=` or the top-bar switcher; with several buildings and none chosen the
 * page asks which one.
 */
export async function UnitsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.units");
  const statuses = await getTranslations("status.unit");
  const { api, locale } = context;
  const prefix = ownerPath(locale, "");
  const requested = param(searchParams.building);
  const building = context.buildings.find((candidate) => candidate.id === requested) ?? focusedBuilding(context);
  const view = param(searchParams.view) === "list" ? "list" : "board";

  if (!building) {
    return (
      <OwnerPage testId="units">
        <PageHeader title={t("title")} description={t("chooseBuilding")} />
        {context.buildings.length === 0 ? (
          <Card>
            <EmptyState icon={IconBuilding} title={t("noBuildings.title")} description={t("noBuildings.body")} />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="choose-building">
            {context.buildings.map((candidate) => (
              <li key={candidate.id}>
                <a
                  href={ownerPath(locale, withQuery("/units", { building: candidate.id }))}
                  className="rounded-card border-border bg-surface shadow-card hover:shadow-raised flex items-center gap-3 border p-4"
                >
                  <Icon icon={IconBuilding} size={22} className="text-primary" />
                  <span className="flex flex-col">
                    <span className="font-semibold">{candidate.name}</span>
                    <span className="text-muted text-sm">{t("unitCount", { count: candidate.unitCount })}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </OwnerPage>
    );
  }

  const base = { building: building.id };
  const header = (
    <PageHeader
      title={t("titleOf", { building: building.name })}
      crumbs={[{ label: building.name }]}
      actions={
        building.access === "grant" ? undefined : (
          <>
            <Button asChild variant="secondary" iconStart={IconDownload}>
              <a href={`/bff/v1/owner/buildings/${building.id}/units/export`} data-testid="export-units">
                {t("export")}
              </a>
            </Button>
            <Button asChild variant="secondary" iconStart={IconUpload}>
              <a href={ownerPath(locale, `/buildings/${building.id}/import`)}>{t("import")}</a>
            </Button>
            <Button asChild iconStart={IconAdd}>
              <a href={ownerPath(locale, `/buildings/${building.id}/units/new`)}>{t("bulk")}</a>
            </Button>
          </>
        )
      }
    />
  );
  const tabHref = (which: "board" | "list") =>
    ownerPath(locale, withQuery("/units", { ...base, view: which === "list" ? "list" : undefined }));
  const viewTabs = (
    <LinkTabs
      label={t("views")}
      current={tabHref(view)}
      tabs={[
        { href: tabHref("board"), label: t("boardTab"), testId: "tab-board" },
        { href: tabHref("list"), label: t("listTab"), testId: "tab-list" },
      ]}
    />
  );

  if (view === "board") {
    const board = await unwrap(
      api.GET("/v1/owner/buildings/{buildingId}/board", { params: { path: { buildingId: building.id } } }),
    );
    return (
      <OwnerPage testId="units" wide>
        {header}
        {viewTabs}
        <UnitBoard board={board} links={{ prefix }} />
      </OwnerPage>
    );
  }

  const page = pageParam(searchParams.page);
  const status = param(searchParams.status);
  const [list, floors] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/units", {
        params: {
          query: {
            buildingId: building.id,
            page,
            perPage: 50,
            status: status as never,
            floorId: param(searchParams.floor),
            q: param(searchParams.q),
            sort: param(searchParams.sort) ?? "unitNo",
            order: param(searchParams.order) === "desc" ? "desc" : "asc",
          },
        },
      }),
    ),
    unwrap(api.GET("/v1/owner/buildings/{buildingId}/floors", { params: { path: { buildingId: building.id } } })).catch(
      () => [],
    ),
  ]);
  return (
    <OwnerPage testId="units">
      {header}
      {viewTabs}
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: (["vacant", "reserved", "occupied", "maintenance", "inactive"] as const).map((value) => ({
              value,
              label: statuses(value),
            })),
          },
          {
            name: "floor",
            label: t("filter.floor"),
            type: "select",
            placeholder: t("filter.allFloors"),
            options: floors.map((floor) => ({ value: floor.id, label: floor.name })),
          },
        ]}
      />
      <SavedViews storageKey="owner-units" />
      <UnitList rows={list.data} prefix={prefix} />
      <ListPagination meta={list.meta} path={ownerPath(locale, "/units")} searchParams={searchParams} locale={locale} />
    </OwnerPage>
  );
}
