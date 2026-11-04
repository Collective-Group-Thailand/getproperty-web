import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ownerPath } from "@/features/owner/shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerContext } from "@/features/owner/shared/server";
import { loadUnitPanel } from "@/features/owner/units/loadUnit";
import { UnitPanel } from "@/features/owner/units/UnitPanel";
import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { isApiError } from "@/lib/api/errors";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("units") };
}

/** One unit (F2 2.1): what the board's drawer shows, as a page (search hits and shared links land here). */
export default async function Unit({ params }: { params: Promise<{ locale: Locale; unitId: string }> }) {
  const { locale, unitId } = await params;
  setRequestLocale(locale);
  const context = await ownerContext();
  const data = await loadUnitPanel(context.api, unitId).catch((error: unknown) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const building = context.buildings.find((candidate) => candidate.id === data.unit.buildingId);
  const t = await getTranslations("owner.units");
  const prefix = ownerPath(locale, "");
  return (
    <OwnerPage testId="unit-page">
      <PageHeader
        title={t("unitTitle", { unit: data.unit.unitNo })}
        description={building?.name}
        crumbs={[
          ...(building ? [{ label: building.name, href: ownerPath(locale, `/units?building=${building.id}`) }] : []),
          { label: data.unit.unitNo },
        ]}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panel.next")}
            testId="unit-action-panel"
            status={<StatusBadgeOf map={UNIT_STATUS} value={data.unit.status} />}
            facts={[
              ...(data.unit.baseRent
                ? [{ key: "rent", label: t("panel.baseRent"), value: formatTHB(data.unit.baseRent, locale) }]
                : []),
              ...(data.unit.floorLevel ? [{ key: "floor", label: t("panel.floor"), value: data.unit.floorLevel }] : []),
            ]}
            primary={
              data.lease ? (
                <Button asChild>
                  <a href={`${prefix}/leases/${data.lease.id}`}>{t("panel.openLease")}</a>
                </Button>
              ) : (
                <Button asChild>
                  <a href={`${prefix}/leases/new?unit=${unitId}`}>{t("panel.newLease")}</a>
                </Button>
              )
            }
            secondary={
              building ? (
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, `/units?building=${building.id}`)}>{t("panel.board")}</a>
                </Button>
              ) : undefined
            }
          />
        }
      >
        <div className="rounded-card border-border bg-surface shadow-card border p-5 md:p-6">
          <UnitPanel
            data={data}
            locale={locale}
            links={{
              unit: `${prefix}/units/${unitId}`,
              lease: (id) => `${prefix}/leases/${id}`,
              newLease: `${prefix}/leases/new?unit=${unitId}`,
              invoice: (id) => `${prefix}/invoices/${id}`,
              meter: (id) => `${prefix}/meters/${id}`,
              request: (id) => `${prefix}/service-requests/${id}`,
            }}
          />
        </div>
      </DetailLayout>
    </OwnerPage>
  );
}
