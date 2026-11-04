import { getTranslations } from "next-intl/server";

import { PARCEL_STATUS, PARCEL_VALUES } from "@/domain/status/parcel";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconParcel } from "@/ui/icons/glyphs/parcel";

import { buildingUnits } from "../service/server";
import { ownerPath, withQuery } from "../shared/links";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";
import { ParcelHandOver, ReceiveParcel } from "./ParcelActions";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The parcels log (F2 2.7, D-212): what waits at the desk (open first by default), with its photo, unit,
 * carrier and tracking; receive, hand over with the resident's PIN or staff-confirmed, return with a reason.
 */
export async function ParcelsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.community.parcels");
  const statuses = await getTranslations("status.parcel");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const status = enumParam(searchParams.status, PARCEL_VALUES);
  const view = status ? "" : param(searchParams.view) === "all" ? "all" : "waiting";
  const base = { buildingId: building?.id };
  const [list, units, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/parcels", {
        params: {
          query: {
            ...base,
            page: pageParam(searchParams.page),
            perPage: 25,
            status,
            open: view === "waiting" ? true : undefined,
            q: param(searchParams.q),
          },
        },
      }),
    ),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
    viewCounts(["waiting", "notified", "picked_up", "returned"] as const, (key) =>
      unwrap(
        api.GET("/v1/owner/parcels", {
          params: {
            query: { ...base, perPage: 1, ...(key === "waiting" ? { open: true } : { status: key }) },
          },
        }),
      ),
    ),
  ]);
  const canManage = ownerCan(me, "parcel.manage") && !readOnly(me);
  const path = (query: Record<string, string | undefined>) => ownerPath(locale, withQuery("/parcels", query));
  const figure = (value: number | undefined) => (value === undefined ? "—" : formatNumber(value, locale));
  const filtered = Boolean(param(searchParams.q) || status);
  return (
    <OwnerPage testId="parcels">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={canManage && building ? <ReceiveParcel buildingId={building.id} units={units} /> : null}
      />
      <StatsRow
        label={t("figures.label")}
        highlight={counts.waiting ? "waiting" : undefined}
        figures={[
          { key: "waiting", label: t("figures.waiting"), value: figure(counts.waiting), href: path({}) },
          {
            key: "notified",
            label: t("figures.notified"),
            value: figure(counts.notified),
            href: path({ status: "notified" }),
          },
          {
            key: "picked_up",
            label: t("figures.pickedUp"),
            value: figure(counts.picked_up),
            href: path({ status: "picked_up" }),
          },
          {
            key: "returned",
            label: t("figures.returned"),
            value: figure(counts.returned),
            href: path({ status: "returned" }),
          },
        ]}
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("show")}
            current={view}
            tabs={[
              { key: "waiting", href: path({}), label: t("waiting"), count: counts.waiting, testId: "view-waiting" },
              { key: "all", href: path({ view: "all" }), label: t("all"), testId: "view-all" },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
              {
                name: "status",
                label: t("status"),
                type: "select",
                placeholder: t("anyStatus"),
                options: PARCEL_VALUES.map((value) => ({ value, label: statuses(value) })),
              },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconParcel}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered || view === "all" ? (
              <Button asChild variant="secondary">
                <a href={path({})}>{t("empty.clear")}</a>
              </Button>
            ) : canManage && building ? (
              <ReceiveParcel buildingId={building.id} units={units} variant="secondary" />
            ) : (
              <Button asChild variant="secondary">
                <a href={path({ view: "all" })}>{t("empty.all")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="parcel-table"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "unit", header: t("unit"), phone: "title", className: "md:w-28" },
            {
              key: "photo",
              header: <span className="sr-only">{t("photo")}</span>,
              phone: "hidden",
              className: "md:w-20",
            },
            { key: "what", header: t("what"), phone: "meta" },
            { key: "received", header: t("received"), phone: "hidden", className: "md:w-44" },
            { key: "status", header: t("status"), phone: "status", className: "md:w-44" },
            {
              key: "actions",
              header: <span className="sr-only">{t("actions")}</span>,
              phone: "figure",
              className: "md:w-56",
            },
          ]}
          rows={list.data.map((parcel) => ({
            key: parcel.id,
            testId: "parcel-row",
            data: { status: parcel.status, unit: parcel.unitNo },
            cells: {
              unit: <span className="font-mono font-medium">{parcel.unitNo}</span>,
              photo: (
                <PhotoThumb fileId={parcel.photoDocumentId} alt={t("photoAlt", { unit: parcel.unitNo })} size="sm" />
              ),
              what: (
                <span className="flex flex-col gap-0.5">
                  <span>
                    {parcel.carrier ?? t("noCarrier")}
                    {parcel.trackingNo ? (
                      <span className="text-muted font-mono text-sm"> · {parcel.trackingNo}</span>
                    ) : null}
                  </span>
                  {parcel.notes ? <span className="text-muted text-sm">{parcel.notes}</span> : null}
                </span>
              ),
              received: (
                <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                  {formatDateTime(parcel.receivedAt, locale)}
                </span>
              ),
              status: (
                <span className="flex flex-col gap-1">
                  <StatusBadgeOf map={PARCEL_STATUS} value={parcel.status} size="sm" />
                  {parcel.pickedUpAt ? (
                    <span className="text-muted text-sm">
                      {t(parcel.pickupConfirmedBy === "staff" ? "handedByStaff" : "handedWithPin", {
                        at: formatDateTime(parcel.pickedUpAt, locale),
                      })}
                    </span>
                  ) : null}
                  {parcel.returnReason ? <span className="text-muted text-sm">{parcel.returnReason}</span> : null}
                </span>
              ),
              actions:
                canManage && (parcel.status === "received" || parcel.status === "notified") ? (
                  <ParcelHandOver parcel={parcel} />
                ) : null,
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/parcels")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
