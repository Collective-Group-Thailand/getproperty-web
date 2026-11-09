import { getTranslations, setRequestLocale } from "next-intl/server";

import { PmPortfolioView } from "@/features/owner/pm/PmViews";
import { PortfolioView } from "@/features/owner/portfolio/PortfolioView";
import { isPmCompany } from "@/features/owner/shell/menu";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const [t, context] = await Promise.all([getTranslations("owner.nav"), ownerContext()]);
  return { title: t(isPmCompany(context.me.currentTenant?.type, context.me.menu) ? "pm_portfolio" : "portfolio") };
}

/**
 * The landlord's portfolio (B7.1, F6.1, D-251): every unit across projects with this month's rent — or, for a PM
 * company (JW3b, D-334), the buildings it manages today.
 */
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
  const context = await ownerContext();
  if (isPmCompany(context.me.currentTenant?.type, context.me.menu)) return <PmPortfolioView context={context} />;
  return <PortfolioView context={context} welcome={welcome === "1"} />;
}
