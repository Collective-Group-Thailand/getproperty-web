import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { SupportView } from "@/features/admin/support/SupportView";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("support_grants") };
}

/** Support grants (F5 5.1). */
export default async function Page() {
  return <SupportView context={await adminContext()} />;
}
