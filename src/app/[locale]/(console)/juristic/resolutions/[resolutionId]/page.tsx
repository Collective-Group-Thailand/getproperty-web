import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResolutionView } from "@/features/owner/juristic/ResolutionsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.resolution");
  return { title: t("title") };
}

/** One resolution as a paper document (JW1a): adopt, void, attachments. */
export default async function Page({ params }: { params: Promise<{ locale: Locale; resolutionId: string }> }) {
  const { locale, resolutionId } = await params;
  setRequestLocale(locale);
  return <ResolutionView context={await ownerContext()} resolutionId={resolutionId} />;
}
