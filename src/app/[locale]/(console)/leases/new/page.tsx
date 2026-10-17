import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeaseWizard } from "@/features/owner/leases/LeaseWizard";
import { OwnerPage, PageHeader } from "@/features/owner/shared/PageHeader";
import { focusedBuilding, ownerContext, param } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";

export async function generateMetadata() {
  const t = await getTranslations("owner.leases");
  return { title: t("newTitle") };
}

/** The lease wizard (F2 2.2); `?unit=` and `?party=` start it from a unit or a party. */
export default async function NewLease({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const context = await ownerContext();
  const t = await getTranslations("owner.leases");
  const unitId = param(query.unit);
  const partyId = param(query.party);
  const [templates, unit, party] = await Promise.all([
    unwrap(context.api.GET("/v1/owner/lease-templates")).catch(() => []),
    unitId
      ? unwrap(context.api.GET("/v1/owner/units/{unitId}", { params: { path: { unitId } } })).catch(() => null)
      : Promise.resolve(null),
    partyId
      ? unwrap(context.api.GET("/v1/owner/parties/{partyId}", { params: { path: { partyId } } })).catch(() => null)
      : Promise.resolve(null),
  ]);
  const building = unit
    ? context.buildings.find((candidate) => candidate.id === unit.buildingId)
    : focusedBuilding(context);
  const settings = building
    ? await unwrap(
        context.api.GET("/v1/owner/settings", { params: { query: { propertyId: building.propertyId } } }),
      ).catch(() => [])
    : [];
  const cap = settings.find((setting) => setting.key === "deposit.max_months_short")?.value;
  return (
    <OwnerPage testId="lease-new">
      <PageHeader title={t("newTitle")} description={t("newBody")} crumbs={[{ label: t("newTitle") }]} />
      <LeaseWizard
        buildings={context.buildings}
        templates={templates}
        depositCapMonths={typeof cap === "string" || typeof cap === "number" ? String(cap) : null}
        initialUnit={unit && unit.status === "vacant" ? unit : null}
        initialParty={party ? { id: party.id, displayName: party.displayName } : null}
      />
    </OwnerPage>
  );
}
