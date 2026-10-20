import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { SubscriptionView } from "@/features/owner/subscription/SubscriptionView";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("subscription") };
}

/** The tenant's subscription to getproperty (F2 2.6). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SubscriptionView context={await ownerContext()} />;
}
