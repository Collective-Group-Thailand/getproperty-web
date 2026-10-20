import { getTranslations, setRequestLocale } from "next-intl/server";

import { RulesView } from "@/features/owner/community/RulesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.rules");
  return { title: t("title") };
}

/** Building rules and acknowledgements (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RulesView context={await ownerContext()} searchParams={await searchParams} />;
}
