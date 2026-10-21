import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { Tm30View } from "@/features/owner/tm30/Tm30View";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.tm30");
  return { title: t("title") };
}

/** TM30 notifications of foreign occupants (D-052, D-216). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Tm30View context={await ownerContext()} searchParams={await searchParams} />;
}
