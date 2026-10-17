import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BulkUnits } from "@/features/owner/buildings/BulkUnits";
import { ownerPath } from "@/features/owner/shared/links";
import { OwnerPage, PageHeader } from "@/features/owner/shared/PageHeader";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";

export async function generateMetadata() {
  const t = await getTranslations("owner.buildings.bulk");
  return { title: t("title") };
}

/** Bulk create units from a number pattern (F2 2.1). */
export default async function NewUnits({ params }: { params: Promise<{ locale: Locale; buildingId: string }> }) {
  const { locale, buildingId } = await params;
  setRequestLocale(locale);
  const context = await ownerContext();
  const building = context.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) notFound();
  const path = { params: { path: { buildingId } } };
  const [floors, profiles] = await Promise.all([
    unwrap(context.api.GET("/v1/owner/buildings/{buildingId}/floors", path)),
    unwrap(context.api.GET("/v1/owner/buildings/{buildingId}/unit-profiles", path)).catch(() => []),
  ]);
  const t = await getTranslations("owner.buildings.bulk");
  return (
    <OwnerPage testId="bulk-page">
      <PageHeader
        title={t("title")}
        description={t("description", { building: building.name })}
        crumbs={[{ label: building.name, href: ownerPath(locale, `/buildings/${building.id}`) }, { label: t("title") }]}
      />
      <BulkUnits
        building={{ id: building.id, name: building.name, code: building.code }}
        floors={floors}
        profiles={profiles}
        boardHref={ownerPath(locale, `/units?building=${building.id}`)}
      />
    </OwnerPage>
  );
}
