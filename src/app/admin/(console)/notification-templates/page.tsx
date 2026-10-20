import { getTranslations } from "next-intl/server";

import { TemplatesView } from "@/features/admin/platform/TemplatesView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("notification_templates") };
}

/** Notification templates (F5 5.2). */
export default async function Page() {
  return <TemplatesView context={await adminContext()} />;
}
