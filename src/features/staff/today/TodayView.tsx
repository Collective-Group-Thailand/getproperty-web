import { getLocale, getTranslations } from "next-intl/server";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconStaff } from "@/ui/icons/glyphs/staff";

import { BuildingSelect } from "../shared/BuildingSelect";
import type { StaffScope } from "../shared/server";

const OPEN_INSPECTIONS = new Set<Schemas["InspectionStatus"]>(["scheduled", "in_progress"]);

/**
 * Today (F4 4.1 §1): the staff member's work grouped — readings before the cut-off (by floor), the
 * inspections to do, the devices waiting to be installed, and work orders / parcels when the tenant
 * has those modules (R2) — with counts, for the focused building. Server-rendered: it is the PWA's
 * start page and must paint fast from the network or the service worker's cache.
 */
export async function TodayView({ scope, menu }: { scope: StaffScope; menu: readonly Schemas["StaffMenuKey"][] }) {
  const t = await getTranslations("staff.today");
  const locale = (await getLocale()) as Locale;
  const has = (key: Schemas["StaffMenuKey"]) => menu.includes(key);

  const [inspections, installs] = await Promise.all([
    has("inspections")
      ? unwrap(scope.api.GET("/v1/staff/inspections", { params: { query: { perPage: 50 } } }))
          .then((page) => page.data.filter((inspection) => OPEN_INSPECTIONS.has(inspection.status)))
          .catch(() => null)
      : Promise.resolve([]),
    has("installs") && scope.buildingId
      ? unwrap(
          scope.api.GET("/v1/staff/devices", {
            params: { query: { buildingId: scope.buildingId, status: "assigned", perPage: 50 } },
          }),
        )
          .then((page) => page.data)
          .catch(() => null)
      : Promise.resolve([]),
  ]);

  const round = scope.rounds?.find((candidate) => candidate.buildingId === scope.buildingId);
  const building = scope.buildings.find((candidate) => candidate.id === scope.buildingId);
  const nothing = (round?.remaining ?? 0) === 0 && (inspections?.length ?? 0) === 0 && (installs?.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="staff-today">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {scope.buildings.length === 1 && building ? (
          <p className="text-muted text-lg" data-testid="building-name">
            {building.name}
          </p>
        ) : null}
        <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
      </header>

      {has("readings") ? (
        <section aria-labelledby="today-readings" className="flex flex-col gap-3">
          <h2 id="today-readings" className="text-lg font-semibold">
            {t("readings.title")}
          </h2>
          {scope.rounds === null ? (
            <Callout tone="warning">{t("unavailable")}</Callout>
          ) : round ? (
            <>
              <BigActionButton
                href="/readings"
                tone={round.remaining > 0 ? "primary" : "default"}
                icon={IconMeter}
                title={round.remaining > 0 ? t("readings.action") : t("readings.done")}
                description={t("readings.cutoff", { date: formatDate(round.cutoffAt, locale) })}
                count={round.remaining}
                aria-label={t("readings.label", { count: round.remaining })}
                data-testid="today-readings"
              />
              {round.floors.length > 0 ? (
                <ul className="text-muted flex flex-wrap gap-2 text-sm" data-testid="today-floors">
                  {round.floors.map((floor) => (
                    <li key={floor.floorId ?? "none"} className="rounded-control bg-bg-subtle px-3 py-1.5">
                      {t("readings.floor", {
                        floor: floor.floorName ?? t("readings.noFloor"),
                        count: floor.items.length,
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-muted">{t("readings.none")}</p>
          )}
        </section>
      ) : null}

      {has("inspections") ? (
        <section aria-labelledby="today-inspections" className="flex flex-col gap-3">
          <h2 id="today-inspections" className="text-lg font-semibold">
            {t("inspections.title")}{" "}
            <span className="text-muted tabular-nums">{t("count", { count: inspections?.length ?? 0 })}</span>
          </h2>
          {inspections === null ? (
            <Callout tone="warning">{t("unavailable")}</Callout>
          ) : inspections.length === 0 ? (
            <p className="text-muted">{t("inspections.none")}</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="today-inspections">
              {inspections.map((inspection) => (
                <li key={inspection.id}>
                  <BigActionButton
                    href={`/inspections/${inspection.id}`}
                    icon={IconCamera}
                    title={t("inspections.item", { unit: inspection.unitNo, type: inspection.type })}
                    description={
                      inspection.scheduledFor
                        ? t("inspections.when", { date: formatDateTime(inspection.scheduledFor, locale) })
                        : t(`inspections.status.${inspection.status}`)
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {has("installs") ? (
        <section aria-labelledby="today-installs" className="flex flex-col gap-3">
          <h2 id="today-installs" className="text-lg font-semibold">
            {t("installs.title")}
          </h2>
          {installs === null ? (
            <Callout tone="warning">{t("unavailable")}</Callout>
          ) : (
            <BigActionButton
              href="/devices"
              icon={IconGateway}
              title={installs.length > 0 ? t("installs.action") : t("installs.open")}
              description={
                installs.length > 0
                  ? t("installs.waiting", {
                      gateways: installs.filter((device) => device.kind === "gateway").length,
                      meters: installs.filter((device) => device.kind !== "gateway").length,
                    })
                  : t("installs.none")
              }
              count={installs.length}
              data-testid="today-installs"
            />
          )}
        </section>
      ) : null}

      {has("service_requests") || has("parcels") ? (
        <section aria-labelledby="today-r2" className="flex flex-col gap-3">
          <h2 id="today-r2" className="text-lg font-semibold">
            {t("later.title")}
          </h2>
          {has("service_requests") ? (
            <BigActionButton icon={IconStaff} title={t("later.workOrders")} description={t("later.soon")} disabled />
          ) : null}
          {has("parcels") ? (
            <BigActionButton icon={IconParcel} title={t("later.parcels")} description={t("later.soon")} disabled />
          ) : null}
        </section>
      ) : null}

      {nothing ? <EmptyState icon={IconCheckCircle} title={t("allDone")} description={t("allDoneHint")} /> : null}
    </div>
  );
}
