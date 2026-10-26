import { getTranslations } from "next-intl/server";

import { GuidesView } from "@/features/admin/platform/GuidesView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("guides") };
}

/** Guides of the public site (B7.13, D-271). */
export default async function Page() {
  return <GuidesView context={await adminContext()} />;
}
