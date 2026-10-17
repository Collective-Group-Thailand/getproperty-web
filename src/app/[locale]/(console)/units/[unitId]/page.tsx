import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ownerPath } from "@/features/owner/shared/links";
import { OwnerPage, PageHeader } from "@/features/owner/shared/PageHeader";
import { ownerContext } from "@/features/owner/shared/server";
import { loadUnitPanel } from "@/features/owner/units/loadUnit";
import { UnitPanel } from "@/features/owner/units/UnitPanel";
import type { Locale } from "@/i18n/routing";
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
      <div className="max-w-3xl">
        <UnitPanel
          data={data}
          locale={locale}
          links={{
            unit: `${prefix}/units/${unitId}`,
            lease: (id) => `${prefix}/leases/${id}`,
            newLease: `${prefix}/leases/new?unit=${unitId}`,
            invoice: (id) => `${prefix}/invoices/${id}`,
            meter: (id) => `${prefix}/meters/${id}`,
          }}
        />
      </div>
    </OwnerPage>
  );
}
