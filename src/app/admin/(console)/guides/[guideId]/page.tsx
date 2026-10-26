import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { GuideDetail } from "@/features/admin/platform/GuidesView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("guides") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One guide: text, facts, body, review and publishing (D-271). */
export default async function Page({ params }: { params: Promise<{ guideId: string }> }) {
  const { guideId } = await params;
  if (!UUID.test(guideId)) notFound();
  return <GuideDetail context={await adminContext()} guideId={guideId} />;
}
