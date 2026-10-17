import { getTranslations, setRequestLocale } from "next-intl/server";

import { CreditsView } from "@/features/owner/payments/CreditsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.payments.credits");
  return { title: t("title") };
}

/** Credits and refunds (F2 2.4). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CreditsView context={await ownerContext()} />;
}
