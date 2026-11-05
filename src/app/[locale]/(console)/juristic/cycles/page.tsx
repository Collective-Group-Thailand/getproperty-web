import { getTranslations, setRequestLocale } from "next-intl/server";

import { BillingWorkspace } from "@/features/owner/billing/BillingWorkspace";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.billing");
  return { title: t("juristicTitle") };
}

/**
 * The juristic office's billing cycles (JW1a, D-303): the same workspace as the monthly cycle, with a frequency filter
 * and advance periods (quarters, halves, years) named in Thai.
 */
export default async function JuristicCycles({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <BillingWorkspace
      context={await ownerContext()}
      searchParams={await searchParams}
      frequencies
      testId="juristic-cycles"
    />
  );
}
