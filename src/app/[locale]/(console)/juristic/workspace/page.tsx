import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceView } from "@/features/owner/juristic/collections/WorkspaceView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.workspace");
  return { title: t("title") };
}

/** Units landlords linked to this juristic office (D-270, JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorkspaceView context={await ownerContext()} />;
}
