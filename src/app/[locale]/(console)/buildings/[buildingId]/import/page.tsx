import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { UnitImport } from "@/features/owner/buildings/UnitImport";
import { ownerPath } from "@/features/owner/shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.buildings.import");
  return { title: t("title") };
}

/** Units from Excel with a preview before anything is written (F2 2.1, D-170). */
export default async function ImportUnits({ params }: { params: Promise<{ locale: Locale; buildingId: string }> }) {
  const { locale, buildingId } = await params;
  setRequestLocale(locale);
  const context = await ownerContext();
  const building = context.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) notFound();
  const t = await getTranslations("owner.buildings.import");
  return (
    <OwnerPage testId="import-page">
      <PageHeader
        title={t("title")}
        description={t("description", { building: building.name })}
        crumbs={[{ label: building.name, href: ownerPath(locale, `/buildings/${building.id}`) }, { label: t("title") }]}
      />
      <UnitImport
        building={{ id: building.id, name: building.name }}
        boardHref={ownerPath(locale, `/units?building=${building.id}`)}
      />
    </OwnerPage>
  );
}
