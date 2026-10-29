import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployerDetailView } from "@/features/owner/employers/EmployersView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.network.employers");
  return { title: t("title") };
}

/** One employer agreement: terms, leases, workers, the month's statement and payroll file (G8, D-299). */
export default async function Employer({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; agreementId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale, agreementId } = await params;
  const { month } = await searchParams;
  setRequestLocale(locale);
  return <EmployerDetailView context={await ownerContext()} agreementId={agreementId} month={month} />;
}
