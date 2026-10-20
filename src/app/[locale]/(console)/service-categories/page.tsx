import { getTranslations, setRequestLocale } from "next-intl/server";

import { CategoriesView } from "@/features/owner/service/CategoriesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.categories");
  return { title: t("title") };
}

/** Service categories and SLA hours (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CategoriesView context={await ownerContext()} />;
}
