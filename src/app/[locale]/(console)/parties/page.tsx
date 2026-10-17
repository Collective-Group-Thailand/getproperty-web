import { getTranslations, setRequestLocale } from "next-intl/server";

import { PartiesView } from "@/features/owner/parties/PartiesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("parties") };
}

/** Residents and other parties (F2 2.2). */
export default async function Parties({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PartiesView context={await ownerContext()} searchParams={await searchParams} />;
}
