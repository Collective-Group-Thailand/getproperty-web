import { getTranslations, setRequestLocale } from "next-intl/server";

import { PortfolioView } from "@/features/owner/portfolio/PortfolioView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("portfolio") };
}

/** The landlord's portfolio (B7.1, F6.1, D-251): every unit across projects with this month's rent. */
export default async function Portfolio({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { welcome } = await searchParams;
  return <PortfolioView context={await ownerContext()} welcome={welcome === "1"} />;
}
