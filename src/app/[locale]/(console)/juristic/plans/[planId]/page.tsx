import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlanView } from "@/features/owner/juristic/collections/PlansView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.plans");
  return { title: t("metaRecord") };
}

/** One payment plan with its instalments (JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; planId: string }> }) {
  const { locale, planId } = await params;
  setRequestLocale(locale);
  return <PlanView context={await ownerContext()} planId={planId} />;
}
