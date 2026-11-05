import { getTranslations, setRequestLocale } from "next-intl/server";

import { OverviewView } from "@/features/owner/juristic/OverviewView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.overview");
  return { title: t("title") };
}

/** The juristic office's morning (JW1a): money billed and owed, its age, this cycle, what is waiting. */
export default async function JuristicOverview({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OverviewView context={await ownerContext()} />;
}
