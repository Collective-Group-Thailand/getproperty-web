import { getLocale, getTranslations } from "next-intl/server";

import { PARCEL_STATUS } from "@/domain/status/parcel";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { Callout } from "@/ui/components/Callout";

import { BuildingSelect } from "../shared/BuildingSelect";
import { PhotoThumb } from "../shared/PhotoThumb";
import type { StaffScope } from "../shared/server";
import { ParcelIntake } from "./ParcelIntake";
import { ParcelPickUp } from "./ParcelPickUp";
import type { StaffUnitChoice } from "./server";

/**
 * Parcels at the desk (F4 4.4, D-212): intake (photo → unit → the resident is notified) and the parcels
 * waiting, each handed over with the resident's PIN or staff-confirmed, or returned with a reason.
 */
export async function ParcelsView({ scope, units }: { scope: StaffScope; units: StaffUnitChoice[] | null }) {
  const t = await getTranslations("staff.parcels");
  const locale = (await getLocale()) as Locale;
  const waiting = scope.buildingId
    ? await unwrap(
        scope.api.GET("/v1/staff/parcels", {
          params: { query: { buildingId: scope.buildingId, open: true, perPage: 100 } },
        }),
      )
        .then((page) => page.data)
        .catch(() => null)
    : [];
  return (
    <div className="flex flex-col gap-6 py-6" data-testid="staff-parcels">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
      </header>
      {scope.buildingId && units ? (
        <ParcelIntake buildingId={scope.buildingId} units={units} />
      ) : (
        <Callout tone="warning">{t("unavailable")}</Callout>
      )}
      <section aria-labelledby="waiting" className="flex flex-col gap-3">
        <h2 id="waiting" className="text-lg font-semibold">
          {t("waiting")}{" "}
          {waiting ? <span className="text-muted tabular-nums">{t("count", { count: waiting.length })}</span> : null}
        </h2>
        {waiting === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : waiting.length === 0 ? (
          <p className="text-muted">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-4" data-testid="parcels-waiting">
            {waiting.map((parcel) => (
              <li
                key={parcel.id}
                id={`parcel-${parcel.id}`}
                className="border-border rounded-card flex flex-col gap-3 border p-3"
                data-testid="parcel"
                data-unit={parcel.unitNo}
              >
                <div className="flex items-start gap-3">
                  <PhotoThumb fileId={parcel.photoDocumentId} alt={t("photoAlt", { unit: parcel.unitNo })} />
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold">{t("unit", { unit: parcel.unitNo })}</span>
                    <span>{[parcel.carrier, parcel.trackingNo].filter(Boolean).join(" · ") || t("noCarrier")}</span>
                    <span className="text-muted text-sm">
                      {t("receivedAt", { at: formatDateTime(parcel.receivedAt, locale) })}
                    </span>
                    <StatusBadgeOf map={PARCEL_STATUS} value={parcel.status} size="sm" />
                  </div>
                </div>
                <ParcelPickUp parcel={parcel} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
