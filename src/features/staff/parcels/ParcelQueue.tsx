"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PARCEL_STATUS } from "@/domain/status/parcel";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { LazySheet } from "@/ui/components/overlays";
import { IconParcel } from "@/ui/icons/glyphs/parcel";

import { StaffList } from "../shell/StaffList";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ParcelPickUp } from "./ParcelPickUp";

type Parcel = Pick<
  Schemas["ParcelDto"],
  "id" | "unitNo" | "carrier" | "trackingNo" | "receivedAt" | "status" | "photoDocumentId"
>;

/**
 * The parcels waiting at the desk (D-212; redesign G7): one row per parcel — no buttons repeated under the rows. A tap
 * opens the parcel's sheet (label photo, carrier, received) with the hand-over by PIN, the staff-confirmed hand-over and
 * the return. Today links to `/parcels#parcel-<id>`, which opens that parcel's sheet straight away.
 */
export function ParcelQueue({ parcels }: { parcels: Parcel[] }) {
  const t = useTranslations("staff.parcels");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = parcels.find((parcel) => parcel.id === openId) ?? null;

  useEffect(() => {
    const wanted = window.location.hash.replace(/^#parcel-/, "");
    // Opening from Today's link: the parcel is already known from the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL hash once, after hydration
    if (wanted && parcels.some((parcel) => parcel.id === wanted)) setOpenId(wanted);
  }, [parcels]);

  const carrierLine = (parcel: Parcel) =>
    [parcel.carrier, parcel.trackingNo].filter(Boolean).join(" · ") || t("noCarrier");

  return (
    <>
      <StaffList
        label={t("waiting")}
        testId="parcels-waiting"
        groups={[
          {
            key: "waiting",
            rows: parcels.map((parcel) => ({
              key: parcel.id,
              onSelect: () => setOpenId(parcel.id),
              icon: IconParcel,
              title: t("unit", { unit: parcel.unitNo }),
              meta: `${carrierLine(parcel)} · ${t("receivedAt", { at: formatDateTime(parcel.receivedAt, locale) })}`,
              testId: "parcel",
              actionTestId: "pick-up",
              data: { unit: parcel.unitNo },
            })),
          },
        ]}
      />
      <LazySheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
        title={open ? t("unit", { unit: open.unitNo }) : ""}
        description={open ? carrierLine(open) : undefined}
        closeLabel={common("close")}
        side="bottom"
      >
        {open ? (
          <div className="flex flex-col gap-4" id={`parcel-${open.id}`} data-testid="parcel-sheet">
            <div className="flex items-center gap-3">
              <PhotoThumb fileId={open.photoDocumentId} alt={t("photoAlt", { unit: open.unitNo })} />
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">
                  {t("receivedAt", { at: formatDateTime(open.receivedAt, locale) })}
                </span>
                <StatusBadgeOf map={PARCEL_STATUS} value={open.status} size="sm" />
              </div>
            </div>
            <ParcelPickUp key={open.id} parcel={open} onDone={() => setOpenId(null)} />
          </div>
        ) : null}
      </LazySheet>
    </>
  );
}
