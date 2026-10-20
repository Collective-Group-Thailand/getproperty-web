import { getTranslations } from "next-intl/server";

import { TemplateDetail } from "@/features/admin/platform/TemplatesView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("notification_templates") };
}

/** One notification template: versions, preview, test send, publish (F5 5.2). */
export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const [{ templateId }, context] = await Promise.all([params, adminContext()]);
  return <TemplateDetail context={context} templateId={templateId} />;
}
