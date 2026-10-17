import { getTranslations } from "next-intl/server";

import { METER_HEALTH_STATUS } from "@/domain/status/meterHealth";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconMeter } from "@/ui/icons/glyphs/meter";

import { FilterBar } from "../shared/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { ListPagination } from "../shared/ListPagination";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const PER_PAGE = 25;

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/** The metering section's sub-pages: meters · review queue. */
export async function MeteringNav({
  current,
  locale,
  open,
}: {
  current: "/meters" | "/meters/reviews";
  locale: OwnerContext["locale"];
  open?: number;
}) {
  const t = await getTranslations("owner.meters");
  return (
    <LinkTabs
      label={t("nav")}
      current={ownerPath(locale, current)}
      tabs={[
        { href: ownerPath(locale, "/meters"), label: t("tab.meters"), testId: "meters-tab-meters" },
        {
          href: ownerPath(locale, "/meters/reviews"),
          label: t("tab.reviews"),
          count: open,
          testId: "meters-tab-reviews",
        },
      ]}
    />
  );
}

/**
 * Meter points of a building (F2 2.5, B3.1): each `asset_item` meter with its `meter_assignment` (unit or
 * common area), its health and last reading with source — filtered by utility, purpose and search, a
 * page at a time — and the readings export. The last reading of each meter on the page is read from its
 * history (`MeterDto` carries neither; contract request).
 */
export async function MetersView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.meters");
  const { api, locale } = context;
  const building =
    context.buildings.find((candidate) => candidate.id === param(searchParams.building)) ??
    focusedBuilding(context) ??
    context.buildings[0];
  const [reviews] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/meter-readings/reviews", {
        params: { query: { status: "open", perPage: 1, buildingId: building?.id } },
      }),
    )
      .then((page) => page.meta.total)
      .catch(() => undefined),
  ]);
  const header = (
    <>
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        actions={
          building ? (
            <a
              className="text-sm underline-offset-4 hover:underline"
              href={`/bff/v1/owner/buildings/${encodeURIComponent(building.id)}/meter-readings/export`}
              data-testid="readings-export"
              download
            >
              {t("export")}
            </a>
          ) : null
        }
      />
      <MeteringNav current="/meters" locale={locale} open={reviews} />
    </>
  );
  if (!building) {
    return (
      <OwnerPage testId="meters">
        {header}
        <Card>
          <EmptyState icon={IconMeter} title={t("noBuilding")} />
        </Card>
      </OwnerPage>
    );
  }

  const [meters, rounds] = await Promise.all([
    unwrap(api.GET("/v1/owner/buildings/{buildingId}/meters", { params: { path: { buildingId: building.id } } })),
    section(unwrap(api.GET("/v1/owner/reading-rounds/current", { params: { query: { buildingId: building.id } } }))),
  ]);
  const utility = param(searchParams.utility);
  const purpose = param(searchParams.purpose);
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
  const roundItems = new Map<string, Schemas["RoundItemDto"]>();
  for (const round of rounds.data ?? [])
    for (const floor of round.floors) for (const item of floor.items) roundItems.set(item.assetItemId, item);
  const last = await Promise.all(
    shown.map((meter) =>
      unwrap(
        api.GET("/v1/owner/meters/{assetItemId}/readings", {
          params: { path: { assetItemId: meter.assetItemId }, query: { perPage: 1, sort: "readAt", order: "desc" } },
        }),
      )
        .then((list) => list.data[0] ?? null)
        .catch(() => null),
    ),
  );
  return (
    <OwnerPage testId="meters">
      {header}
      <FilterBar
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
          {
            name: "purpose",
            label: t("filter.purpose"),
            type: "select",
            placeholder: t("filter.allPurposes"),
            options: (["unit", "common_area", "main"] as const).map((value) => ({
              value,
              label: t(`purpose.${value}`),
            })),
          },
        ]}
      />
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={IconMeter} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <div className="border-border bg-surface rounded-card overflow-x-auto border">
          <table className="w-full min-w-[48rem] text-sm" data-testid="meter-table">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr className="border-border text-muted border-b">
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.meter")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.assignment")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.health")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.last")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((meter, index) => {
                const reading = last[index];
                const item = roundItems.get(meter.assetItemId);
                return (
                  <tr
                    key={meter.id}
                    className="border-border border-b"
                    data-testid="meter-row"
                    data-utility={meter.utility}
                  >
                    <th scope="row" className="px-3 py-2 text-start font-normal">
                      <a
                        className="font-mono font-semibold underline-offset-4 hover:underline"
                        href={ownerPath(locale, withQuery(`/meters/${meter.assetItemId}`, { building: building.id }))}
                      >
                        {meter.code}
                      </a>
                      <span className="text-muted block text-xs">
                        {t(`utility.${meter.utility}`)} · {meter.name}
                      </span>
                    </th>
                    <td className="px-3 py-2">
                      {meter.unitNo ? (
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/units/${meter.unitId}`)}
                        >
                          {t("unit", { unit: meter.unitNo })}
                        </a>
                      ) : (
                        (meter.commonAreaLabel ?? t(`purpose.${meter.purpose}`))
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item?.health ? (
                        <StatusBadgeOf map={METER_HEALTH_STATUS} value={item.health} size="sm" />
                      ) : (
                        <span className="text-muted">{t("healthUnknown")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {reading ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono tabular-nums">{reading.register}</span>
                          {isSource(reading.source) ? <ReadingSourceBadge source={reading.source} /> : null}
                          <span className="text-muted">{formatDateTime(reading.readAt, locale)}</span>
                        </span>
                      ) : (
                        <span className="text-muted">{t("never")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
