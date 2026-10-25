import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { DashboardView } from "@/features/owner/dashboard/DashboardView";
import { ownerContext } from "@/features/owner/shared/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("dashboard") };
}

/** The morning dashboard (F2 2.1): the Today queue, the month's figures, the cycle and the compliance score. */
export default async function Dashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const context = await ownerContext();
  // Sign-in lands here; a landlord has no building dashboard — its home is the portfolio (B7.1, D-251).
  if (!context.me.menu.includes("dashboard") && context.me.menu.includes("portfolio"))
    redirect(getPathname({ href: "/portfolio", locale }));
  return <DashboardView context={context} />;
}
