import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { DashboardView } from "@/features/owner/dashboard/DashboardView";
import { ownerContext } from "@/features/owner/shared/server";
import { isJuristicTenant, isPmCompany } from "@/features/owner/shell/menu";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("dashboard") };
}

/** The morning dashboard (F2 2.1): the Today queue, the month's figures, the cycle and the compliance score. */
export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const context = await ownerContext();
  // Sign-in lands here; a landlord has no building dashboard — its home is the portfolio (B7.1, D-251).
  if (!context.me.menu.includes("dashboard") && context.me.menu.includes("portfolio"))
    redirect(getPathname({ href: "/portfolio", locale }));
  // An estate agency's home is the units owners mandated to it (G2, D-293).
  if (!context.me.menu.includes("dashboard") && context.me.menu.includes("mandated_units"))
    redirect(getPathname({ href: "/mandated-units", locale }));
  // A PM company's home is the buildings it manages (JW3b, D-334) — unless it also operates buildings of its own.
  if (
    isPmCompany(context.me.currentTenant?.type, context.me.menu) &&
    (!context.me.menu.includes("dashboard") ||
      !context.buildings.some((building) => building.operatorTenantId === context.me.currentTenant?.id))
  )
    redirect(getPathname({ href: "/portfolio", locale }));
  // A juristic office's morning starts at its overview (pack J, J-DESIGN §1.1 — who still owes what).
  if (isJuristicTenant(context.me.currentTenant?.type)) redirect(getPathname({ href: "/juristic", locale }));
  return <DashboardView context={context} allTasks={query.tasks === "all"} />;
}
