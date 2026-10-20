import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { TariffsView } from "@/features/admin/tariffs/TariffsView";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("utility_tariffs") };
}

/** Utility tariffs (F5 5.2). */
export default async function Page() {
  return <TariffsView context={await adminContext()} />;
}
