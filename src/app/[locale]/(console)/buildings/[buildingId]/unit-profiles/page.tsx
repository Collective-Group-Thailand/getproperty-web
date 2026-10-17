import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { UnitProfiles } from "@/features/owner/buildings/UnitProfiles";
import { ownerPath } from "@/features/owner/shared/links";
import { OwnerPage, PageHeader } from "@/features/owner/shared/PageHeader";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";

export async function generateMetadata() {
  const t = await getTranslations("owner.buildings.profiles");
  return { title: t("title") };
}

/** Unit types of a building: default rent, deposit, advance rent and lease lines (F2 2.1). */
export default async function Profiles({ params }: { params: Promise<{ locale: Locale; buildingId: string }> }) {
  const { locale, buildingId } = await params;
  setRequestLocale(locale);
  const context = await ownerContext();
  const building = context.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) notFound();
  const profiles = await unwrap(
    context.api.GET("/v1/owner/buildings/{buildingId}/unit-profiles", { params: { path: { buildingId } } }),
  );
  const t = await getTranslations("owner.buildings.profiles");
  return (
    <OwnerPage testId="profiles-page">
      <PageHeader
        title={t("title")}
        description={t("description", { building: building.name })}
        crumbs={[{ label: building.name, href: ownerPath(locale, `/buildings/${building.id}`) }, { label: t("title") }]}
      />
      <UnitProfiles buildingId={building.id} profiles={profiles} />
    </OwnerPage>
  );
}
