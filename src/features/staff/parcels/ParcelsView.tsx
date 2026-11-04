import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";

import { StaffSection } from "../shell/StaffList";
import type { StaffScope } from "../shared/server";
import { ParcelIntake } from "./ParcelIntake";
import { ParcelQueue } from "./ParcelQueue";
import type { StaffUnitChoice } from "./server";

/**
 * Parcels at the desk (F4 4.4, D-212; redesign G7): intake (photo → unit → the resident is notified) in one card, then
 * the parcels waiting as rows — each opens its sheet to hand it over with the resident's PIN, staff-confirmed, or to
 * return it with a reason.
 */
export async function ParcelsView({ scope, units }: { scope: StaffScope; units: StaffUnitChoice[] | null }) {
  const t = await getTranslations("staff.parcels");
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
    <div className="flex flex-col gap-8 py-6" data-testid="staff-parcels">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("lede")}</p>
      </header>
      {scope.buildingId && units ? (
        <ParcelIntake buildingId={scope.buildingId} units={units} />
      ) : (
        <Callout tone="warning">{t("unavailable")}</Callout>
      )}
      <StaffSection
        id="waiting"
        title={t("waiting")}
        count={waiting?.length}
        end={waiting?.length ? <span className="text-muted text-sm">{t("tapHint")}</span> : undefined}
      >
        {waiting === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : waiting.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconPackageCheck}
            title={t("none")}
            description={t("noneHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/">{t("backToday")}</Link>
              </Button>
            }
          />
        ) : (
          <ParcelQueue parcels={waiting} />
        )}
      </StaffSection>
    </div>
  );
}
