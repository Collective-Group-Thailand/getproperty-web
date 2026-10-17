import { getTranslations, setRequestLocale } from "next-intl/server";

import { getOperatorActor } from "@/lib/auth/actor";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("dashboard") };
}

/** The morning dashboard's place (its queues are F2 2.1). */
export default async function Dashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await getOperatorActor("owner");
  const t = await getTranslations("owner.nav");
  return (
    <div className="px-4 py-6 md:px-8" data-testid="owner-dashboard">
      <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
      <p className="text-muted mt-1" data-testid="dashboard-tenant">
        {actor?.me.currentTenant?.displayName}
      </p>
    </div>
  );
}
