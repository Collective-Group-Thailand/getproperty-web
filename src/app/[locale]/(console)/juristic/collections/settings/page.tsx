import { getTranslations, setRequestLocale } from "next-intl/server";

import { LadderView } from "@/features/owner/juristic/collections/LadderView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.ladder");
  return { title: t("title") };
}

/** The collection ladder editor (JW1b, J-DESIGN §4). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LadderView context={await ownerContext()} searchParams={await searchParams} />;
}
