import { useTranslations } from "next-intl";

import { INVOICE_STATUS } from "@/domain/status/invoice";
import { LEASE_STATUS } from "@/domain/status/lease";
import { READING_STATUS } from "@/domain/status/reading";
import { READING_SOURCE } from "@/domain/status/readingSource";
import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPeriodKey, formatTHB, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconWater } from "@/ui/icons/glyphs/water";

import { PhotoThumb } from "../shared/PhotoThumb";
import { UnitStatusAction } from "./UnitStatusAction";

export interface UnitMeterView {
  meter: Schemas["MeterDto"];
  last: Schemas["MeterReadingDto"] | null;
}

export interface UnitPanelData {
  unit: Schemas["UnitDto"];
  lease: Schemas["LeaseDto"] | null;
  meters: UnitMeterView[];
  invoices: Schemas["InvoiceSummaryDto"][];
}

const meterUnit = (utility: Schemas["Utility"]) => (utility === "water" ? "m3" : "kWh");

/**
 * Everything about one unit the owner needs at a glance (F2 2.1 unit drawer): status, the occupancy
 * and lease in force, the last reading of each meter with its photo and source, the open invoices and —
 * from R2 — open service requests. Shared by the board's drawer (fetched in the browser) and the unit
 * page (rendered on the server); it only presents what the API returned.
 */
export function UnitPanel({
  data,
  locale,
  links,
  onChanged,
}: {
  data: UnitPanelData;
  /** Called after a change made from the panel (the drawer refetches; the page refreshes itself). */
  onChanged?: () => void;
  locale: Locale;
  links: {
    unit: string;
    lease: (id: string) => string;
    newLease: string;
    invoice: (id: string) => string;
    meter: (id: string) => string;
  };
}) {
  const t = useTranslations("owner.units.panel");
  const { unit, lease, meters, invoices } = data;
  return (
    <div className="flex flex-col gap-5" data-testid="unit-panel" data-unit={unit.unitNo}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadgeOf map={UNIT_STATUS} value={unit.status} />
        {unit.statusReason ? <span className="text-muted text-sm">{unit.statusReason}</span> : null}
        {unit.nextActions.includes("set-status") ? <UnitStatusAction unit={unit} onDone={onChanged} /> : null}
      </div>

      <DescriptionList
        items={[
          { id: "type", term: t("profile"), description: unit.unitProfileName ?? null },
          { id: "rent", term: t("baseRent"), description: unit.baseRent ? formatTHB(unit.baseRent, locale) : null },
          { id: "area", term: t("area"), description: unit.areaSqm ? t("sqm", { area: unit.areaSqm }) : null },
          { id: "floor", term: t("floor"), description: unit.floorLevel ?? null },
        ]}
      />

      <section aria-labelledby={`lease-${unit.id}`} className="flex flex-col gap-2" data-testid="unit-lease">
        <h3 id={`lease-${unit.id}`} className="font-semibold">
          {t("lease")}
        </h3>
        {lease ? (
          <div className="rounded-control border-border flex flex-col gap-2 border p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{lease.lesseeName ?? t("hiddenParty")}</span>
              <StatusBadgeOf map={LEASE_STATUS} value={lease.status} size="sm" />
            </p>
            <p className="text-muted text-sm">
              {t("leaseTerm", {
                start: formatDate(lease.startDate, locale),
                end: formatDate(lease.endDate, locale),
                rent: formatTHB(lease.rent, locale),
              })}
            </p>
            {lease.parties.length > 1 ? (
              <p className="text-muted text-sm">
                {t("coResidents", {
                  names: lease.parties
                    .filter((party) => party.role !== "lessee")
                    .map((party) => party.displayName ?? "—")
                    .join(", "),
                })}
              </p>
            ) : null}
            <a
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              href={links.lease(lease.id)}
            >
              {t("openLease")}
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted text-sm">{t("noLease")}</p>
            {unit.status === "vacant" ? (
              <Button asChild size="sm" iconStart={IconLease}>
                <a href={links.newLease} data-testid="unit-new-lease">
                  {t("newLease")}
                </a>
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby={`meters-${unit.id}`} className="flex flex-col gap-2" data-testid="unit-meters">
        <h3 id={`meters-${unit.id}`} className="font-semibold">
          {t("readings")}
        </h3>
        {meters.length === 0 ? (
          <p className="text-muted text-sm">{t("noMeters")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meters.map(({ meter, last }) => (
              <li
                key={meter.id}
                className="rounded-control border-border flex items-center gap-3 border p-3"
                data-testid="unit-meter"
              >
                {last?.evidenceDocumentId ? (
                  <PhotoThumb
                    fileId={last.evidenceDocumentId}
                    alt={t("photoAlt", { code: meter.code, date: formatDateTime(last.readAt, locale) })}
                    size="sm"
                  />
                ) : (
                  <span className="rounded-control bg-bg-subtle text-muted flex size-12 items-center justify-center">
                    <Icon icon={meter.utility === "water" ? IconWater : IconElectric} size={20} />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <a className="font-medium underline-offset-4 hover:underline" href={links.meter(meter.assetItemId)}>
                    {meter.code}
                  </a>
                  {last ? (
                    <span className="text-muted flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono tabular-nums">
                        {formatUnits(last.register, meterUnit(meter.utility), locale)}
                      </span>
                      <StatusBadgeOf map={READING_SOURCE} value={last.source} size="sm" />
                      {last.reviewState !== "accepted" ? (
                        <StatusBadgeOf map={READING_STATUS} value={last.reviewState} size="sm" />
                      ) : null}
                      <span>{formatDateTime(last.readAt, locale)}</span>
                    </span>
                  ) : (
                    <span className="text-muted text-sm">{t("noReading")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`invoices-${unit.id}`} className="flex flex-col gap-2" data-testid="unit-invoices">
        <h3 id={`invoices-${unit.id}`} className="font-semibold">
          {t("invoices")}
        </h3>
        {invoices.length === 0 ? (
          <p className="text-muted text-sm">{t("noInvoices")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <a
                  href={links.invoice(invoice.id)}
                  className="rounded-control border-border hover:bg-bg-subtle flex items-center justify-between gap-2 border p-3"
                >
                  <span className="flex flex-col">
                    <span className="font-mono text-sm">{invoice.number ?? t("draft")}</span>
                    <span className="text-muted text-xs">
                      {formatPeriodKey(invoice.periodStart.slice(0, 7), locale)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatTHB(invoice.balance, locale)}</span>
                    <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`requests-${unit.id}`} className="flex flex-col gap-1">
        <h3 id={`requests-${unit.id}`} className="font-semibold">
          {t("serviceRequests")}
        </h3>
        <p className="text-muted text-sm">{t("serviceRequestsLater")}</p>
      </section>
    </div>
  );
}
