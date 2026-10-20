import { getTranslations } from "next-intl/server";

import { PARCEL_STATUS, PARCEL_VALUES } from "@/domain/status/parcel";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconParcel } from "@/ui/icons/glyphs/parcel";

import { buildingUnits } from "../service/server";
import { ownerPath } from "../shared/links";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { CommunityNav } from "./CommunityNav";
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
  const [list, units] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/parcels", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            buildingId: building?.id,
            status,
            open: !status && param(searchParams.view) !== "all" ? true : undefined,
            q: param(searchParams.q),
          },
        },
      }),
    ),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
  ]);
  const canManage = ownerCan(me, "parcel.manage") && !readOnly(me);
  return (
    <OwnerPage testId="parcels">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={canManage && building ? <ReceiveParcel buildingId={building.id} units={units} /> : null}
      />
      <CommunityNav current="/parcels" locale={locale} />
      <FilterBar
        fields={[
          { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
          {
            name: "view",
            label: t("show"),
            type: "select",
            placeholder: t("waiting"),
            options: [{ value: "all", label: t("all") }],
          },
          {
            name: "status",
            label: t("status"),
            type: "select",
            placeholder: t("anyStatus"),
            options: PARCEL_VALUES.map((value) => ({ value, label: statuses(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconParcel} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="parcel-table"
          minWidth="52rem"
          columns={[
            { key: "photo", header: <span className="sr-only">{t("photo")}</span> },
            { key: "unit", header: t("unit") },
            { key: "what", header: t("what") },
            { key: "status", header: t("status") },
            { key: "actions", header: <span className="sr-only">{t("actions")}</span> },
          ]}
          rows={list.data.map((parcel) => ({
            key: parcel.id,
            testId: "parcel-row",
            data: { status: parcel.status, unit: parcel.unitNo },
            cells: {
              photo: (
                <PhotoThumb fileId={parcel.photoDocumentId} alt={t("photoAlt", { unit: parcel.unitNo })} size="sm" />
              ),
              unit: <span className="font-mono font-semibold">{parcel.unitNo}</span>,
              what: (
                <span className="flex flex-col">
                  <span>{[parcel.carrier, parcel.trackingNo].filter(Boolean).join(" · ") || t("noCarrier")}</span>
                  <span className="text-muted text-xs">
                    {t("receivedAt", { at: formatDateTime(parcel.receivedAt, locale) })}
                  </span>
                  {parcel.notes ? <span className="text-muted text-xs">{parcel.notes}</span> : null}
                </span>
              ),
              status: (
                <span className="flex flex-col gap-1">
                  <StatusBadgeOf map={PARCEL_STATUS} value={parcel.status} size="sm" />
                  {parcel.pickedUpAt ? (
                    <span className="text-muted text-xs">
                      {t(parcel.pickupConfirmedBy === "staff" ? "handedByStaff" : "handedWithPin", {
                        at: formatDateTime(parcel.pickedUpAt, locale),
                      })}
                    </span>
                  ) : null}
                  {parcel.returnReason ? <span className="text-muted text-xs">{parcel.returnReason}</span> : null}
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
