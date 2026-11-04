import { getTranslations } from "next-intl/server";

import { METER_HEALTH_STATUS } from "@/domain/status/meterHealth";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconMeter } from "@/ui/icons/glyphs/meter";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const PER_PAGE = 25;
const PURPOSES = ["unit", "common_area", "main"] as const;

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/** Readings waiting for a person in a building — the count of the meters' attention line and the review queue. */
export async function openReviews(context: OwnerContext, buildingId: string | undefined): Promise<number | undefined> {
  return unwrap(
    context.api.GET("/v1/owner/meter-readings/reviews", {
      params: { query: { status: "open", perPage: 1, buildingId } },
    }),
  )
    .then((page) => page.meta.total)
    .catch(() => undefined);
}

/**
 * Meter points of a building (F2 2.5, B3.1; G4): one attention line when readings wait for a check, one toolbar
 * (where it measures · search · utility) and a table whose rows open the meter — its code, what it measures, the
 * device's health, the last accepted reading with its source and time. The API gives the building's meters at once;
 * the page narrows them by the URL's filters and shows 25 at a time.
 */
export async function MetersView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.meters");
  const { api, locale } = context;
  const building =
    context.buildings.find((candidate) => candidate.id === param(searchParams.building)) ??
    focusedBuilding(context) ??
    context.buildings[0];
  const reviews = await openReviews(context, building?.id);
  const header = (
    <PageHeader
      title={t("title")}
      description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
      actions={
        building ? (
          <Button asChild variant="secondary" iconStart={IconDownload}>
            <a
              href={`/bff/v1/owner/buildings/${encodeURIComponent(building.id)}/meter-readings/export`}
              data-testid="readings-export"
              download
            >
              {t("export")}
            </a>
          </Button>
        ) : null
      }
    />
  );
  if (!building) {
    return (
      <OwnerPage testId="meters">
        {header}
        <EmptyState
          variant="card"
          icon={IconMeter}
          title={t("noBuilding")}
          description={t("noBuildingBody")}
          action={
            <Button asChild variant="secondary" iconStart={IconBuilding}>
              <a href={ownerPath(locale, "/buildings")}>{t("addBuilding")}</a>
            </Button>
          }
        />
      </OwnerPage>
    );
  }

  const meters = await unwrap(
    api.GET("/v1/owner/buildings/{buildingId}/meters", { params: { path: { buildingId: building.id } } }),
  );
  const utility = param(searchParams.utility);
  const purpose = PURPOSES.find((value) => value === param(searchParams.purpose));
  const q = param(searchParams.q)?.toLowerCase();
  const filtered = meters.filter(
    (meter) =>
      (!utility || meter.utility === utility) &&
      (!purpose || meter.purpose === purpose) &&
      (!q ||
        meter.code.toLowerCase().includes(q) ||
        (meter.unitNo ?? "").toLowerCase().includes(q) ||
        meter.name.toLowerCase().includes(q)),
  );
  const page = pageParam(searchParams.page);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const tabPath = (value?: string) =>
    ownerPath(
      locale,
      withQuery("/meters", {
        building: param(searchParams.building),
        purpose: value,
        utility,
        q: param(searchParams.q),
      }),
    );
  const narrowed = Boolean(utility || purpose || q);

  return (
    <OwnerPage testId="meters">
      {header}
      {reviews ? (
        <Callout
          tone="info"
          title={t("attention.title", { count: formatNumber(reviews, locale) })}
          action={
            <a
              className="text-fg font-medium underline underline-offset-4"
              href={ownerPath(locale, "/meters/reviews")}
              data-testid="meters-tab-reviews"
            >
              {t("attention.action", { count: formatNumber(reviews, locale) })}
            </a>
          }
        >
          {t("attention.body")}
        </Callout>
      ) : null}
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("filter.purpose")}
            current={purpose ?? "all"}
            tabs={[
              { key: "all", href: tabPath(), label: t("filter.allPurposes") },
              ...PURPOSES.map((value) => ({ key: value, href: tabPath(value), label: t(`purpose.${value}`) })),
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              {
                name: "utility",
                label: t("filter.utility"),
                type: "select",
                placeholder: t("filter.allUtilities"),
                options: [
                  { value: "electric", label: t("utility.electric") },
                  { value: "water", label: t("utility.water") },
                ],
              },
            ]}
          />
        }
      />
      {shown.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconMeter}
          title={narrowed ? t("empty.filteredTitle") : t("empty.title")}
          description={narrowed ? t("empty.filteredBody") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={narrowed ? ownerPath(locale, "/meters") : ownerPath(locale, "/devices")}>
                {narrowed ? t("empty.clear") : t("empty.devices")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="meter-table"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "meter", header: t("col.meter"), phone: "title" },
            { key: "assignment", header: t("col.assignment"), phone: "meta", className: "md:w-40" },
            { key: "health", header: t("col.health"), phone: "status", className: "md:w-36" },
            { key: "last", header: t("col.last"), align: "end", phone: "figure", className: "md:w-36" },
            { key: "source", header: t("col.source"), phone: "hidden", className: "md:w-32" },
            { key: "readAt", header: t("col.readAt"), phone: "meta", className: "md:w-44" },
          ]}
          rows={shown.map((meter) => {
            const reading = meter.lastReading;
            return {
              key: meter.id,
              href: ownerPath(locale, withQuery(`/meters/${meter.assetItemId}`, { building: building.id })),
              testId: "meter-row",
              data: { utility: meter.utility },
              cells: {
                meter: (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-mono">{meter.code}</span>
                    <span className="text-muted text-sm font-normal">
                      {t(`utility.${meter.utility}`)} · {meter.name}
                    </span>
                  </span>
                ),
                assignment: meter.unitNo ? (
                  <span>{t("unit", { unit: meter.unitNo })}</span>
                ) : (
                  <span>{meter.commonAreaLabel ?? t(`purpose.${meter.purpose}`)}</span>
                ),
                health: meter.health ? (
                  <StatusBadgeOf map={METER_HEALTH_STATUS} value={meter.health} size="sm" />
                ) : (
                  <span className="text-muted text-sm">{t("healthUnknown")}</span>
                ),
                last: reading ? (
                  <span className="font-mono tabular-nums">{reading.register}</span>
                ) : (
                  <span className="text-muted">{t("never")}</span>
                ),
                source: reading && isSource(reading.source) ? <ReadingSourceBadge source={reading.source} /> : null,
                readAt: reading ? (
                  <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                    {formatDateTime(reading.readAt, locale)}
                  </span>
                ) : null,
              },
            };
          })}
        />
      )}
      <ListPagination
        meta={{ page, perPage: PER_PAGE, total: filtered.length }}
        path={ownerPath(locale, "/meters")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
