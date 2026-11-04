import { getTranslations } from "next-intl/server";

import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { StatsRow } from "@/ui/components/StatsRow";
import { formatNumber, formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
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

  // "All buildings" on a tenant with several: one section per building — its figures and the way to its board — rather
  // than a bare picker (Stitch revision). One building, or the one focused in the column, opens straight on the board.
  if (!building) {
    const boards = await Promise.all(
      context.buildings.map(async (candidate) => ({
        building: candidate,
        board: await unwrap(
          api.GET("/v1/owner/buildings/{buildingId}/board", { params: { path: { buildingId: candidate.id } } }),
        ).catch(() => null),
      })),
    );
    return (
      <OwnerPage testId="units">
        <PageHeader
          title={context.buildings.length === 0 ? t("title") : t("allBuildings")}
          description={context.buildings.length === 0 ? undefined : t("allBuildingsLede")}
        />
        {context.buildings.length === 0 ? (
          <Card>
            <EmptyState
              icon={IconBuilding}
              title={t("noBuildings.title")}
              description={t("noBuildings.body")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/buildings")}>{t("noBuildings.action")}</a>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-8" data-testid="choose-building">
            {boards.map(({ building: candidate, board }) => (
              <section key={candidate.id} aria-labelledby={`units-${candidate.id}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id={`units-${candidate.id}`} className="m-0 text-lg font-semibold">
                    {candidate.name}
                    <span className="text-muted ms-2 text-sm font-normal">
                      {t("unitCount", { count: candidate.unitCount })}
                    </span>
                  </h2>
                  <Button asChild variant="secondary" size="sm">
                    <a href={ownerPath(locale, withQuery("/units", { building: candidate.id }))}>{t("openBoard")}</a>
                  </Button>
                </div>
                {board ? <BoardFigures summary={board.summary} buildingId={candidate.id} locale={locale} /> : null}
              </section>
            ))}
          </div>
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
    <ViewTabs
      label={t("views")}
      current={view}
      tabs={[
        { key: "board", href: tabHref("board"), label: t("boardTab"), testId: "tab-board" },
        { key: "list", href: tabHref("list"), label: t("listTab"), testId: "tab-list" },
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
        <BoardFigures summary={board.summary} buildingId={building.id} locale={locale} />
        <ListToolbar tabs={viewTabs} />
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
      <ListToolbar
        tabs={viewTabs}
        filters={
          <FilterBar
            variant="toolbar"
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
        }
      />
      <SavedViews storageKey="owner-units" />
      <UnitList rows={list.data} prefix={prefix} />
      <ListPagination meta={list.meta} path={ownerPath(locale, "/units")} searchParams={searchParams} locale={locale} />
    </OwnerPage>
  );
}

/** The building's units by status (the API's board summary): vacant — the figure that needs a next step — highlighted. */
async function BoardFigures({
  summary,
  buildingId,
  locale,
}: {
  summary: Schemas["BoardSummaryDto"];
  buildingId: string;
  locale: Locale;
}) {
  const t = await getTranslations("owner.units");
  const statuses = await getTranslations("status.unit");
  return (
    <StatsRow
      label={t("figures")}
      highlight="vacant"
      figures={[
        { key: "total", label: t("figureTotal"), value: formatNumber(summary.total, locale) },
        ...(["vacant", "occupied", "reserved", "maintenance"] as const).map((status) => ({
          key: status,
          label: statuses(status),
          value: formatNumber(summary[status], locale),
          href: ownerPath(locale, withQuery("/units", { building: buildingId, view: "list", status })),
        })),
        { key: "occupancy", label: t("figureOccupancy"), value: formatPercent(summary.occupancyPct, locale, 1) },
      ]}
    />
  );
}
