import { getTranslations, setRequestLocale } from "next-intl/server";

import { IncomeView } from "@/features/owner/landlord-docs/IncomeView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.income");
  return { title: t("title") };
}

/** Annual rental income per unit for the owner's income tax (B7.5, D-253, section 40(5)). */
export default async function Income({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  const { year } = await searchParams;
  setRequestLocale(locale);
  return <IncomeView context={await ownerContext()} year={year} />;
}
