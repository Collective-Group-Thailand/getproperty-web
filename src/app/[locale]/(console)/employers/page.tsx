import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployersView } from "@/features/owner/employers/EmployersView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.network.employers");
  return { title: t("title") };
}

/** Employer housing: companies paying for their workers' rooms (G8, D-299). */
export default async function Employers({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale } = await params;
  const { new: create } = await searchParams;
  setRequestLocale(locale);
  return <EmployersView context={await ownerContext()} create={create === "1"} />;
}
