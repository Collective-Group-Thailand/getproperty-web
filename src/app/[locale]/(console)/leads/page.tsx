import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeadsView } from "@/features/owner/leads/LeadsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("leads") };
}

/** The enquiries inbox: waiting for an answer, in progress, closed; upcoming viewings (F6.2 part 2, D-252). */
export default async function Leads({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const { view } = await searchParams;
  setRequestLocale(locale);
  return <LeadsView context={await ownerContext()} view={view} />;
}
