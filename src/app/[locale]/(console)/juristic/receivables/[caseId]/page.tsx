import { getTranslations, setRequestLocale } from "next-intl/server";

import { CaseView } from "@/features/owner/juristic/collections/CaseView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.case");
  return { title: t("metaTitle") };
}

/** One collection case: the timeline, the next step, disputes and decisions (JW1b, J-DESIGN §4). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; caseId: string }> }) {
  const { locale, caseId } = await params;
  setRequestLocale(locale);
  return <CaseView context={await ownerContext()} caseId={caseId} />;
}
